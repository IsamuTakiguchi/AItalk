/**
 * Transcript-agreement scoring.
 *
 * Important framing: the Web Speech API returns *text only* — there is no phoneme
 * data and per-alternative `confidence` is unreliable or absent. So this measures
 * how closely the recogniser's transcript matches the target sentence, which is
 * related to pronunciation but is not a pronunciation score. The recogniser's own
 * language model also auto-corrects toward plausible English, so a mispronounced
 * word can transcribe correctly and a correct word can be mangled in an unusual
 * sentence. The UI must present this as 認識スコア, never as 発音スコア, and lesson
 * completion is never gated on it.
 *
 * Everything here is local and synchronous, so results appear instantly.
 */

export type WordStatus = "correct" | "near" | "missing" | "extra";

export type ScoredWord = {
  /** The target word, or the surplus spoken word when status is "extra". */
  text: string;
  status: WordStatus;
  /** What the recogniser heard instead, when it differs. */
  spoken?: string;
};

export type ScoreResult = {
  score: number;
  words: ScoredWord[];
  /** True when nothing was transcribed — show a retry prompt, not a zero. */
  empty: boolean;
};

export type ScoreBand = "great" | "good" | "needsWork";

/**
 * Two-word sequences canonicalised to their contraction. Only genuinely
 * unambiguous pairs belong here: "i have" is excluded on purpose because in
 * "Can I have a coffee" the `have` is a main verb, and folding it to "i've"
 * would both mis-score and — since the target words are shown back to the
 * learner — display a sentence they should not read aloud.
 */
const CONTRACTIONS: Record<string, string> = {
  "i am": "i'm", "you are": "you're", "we are": "we're", "they are": "they're",
  "he is": "he's", "she is": "she's", "it is": "it's", "that is": "that's",
  "there is": "there's", "what is": "what's", "let us": "let's",
  "do not": "don't", "does not": "doesn't", "did not": "didn't",
  "cannot": "can't", "can not": "can't", "will not": "won't",
  "is not": "isn't", "are not": "aren't", "was not": "wasn't", "were not": "weren't",
  "would not": "wouldn't", "could not": "couldn't", "should not": "shouldn't",
  "have not": "haven't", "has not": "hasn't", "had not": "hadn't",
};

/** Digits the recogniser may return either way round. */
const NUMBERS: Record<string, string> = {
  "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
  "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten",
  "11": "eleven", "12": "twelve", "20": "twenty", "30": "thirty", "100": "hundred",
  "1st": "first", "2nd": "second", "3rd": "third", "4th": "fourth", "5th": "fifth",
};

const FILLERS = new Set(["um", "uh", "er", "ah", "hmm", "mm", "eh"]);

/**
 * A token carries both what to compare (`norm`) and what to show the learner
 * (`surface`). Keeping the surface form is what lets the word chips display the
 * real sentence instead of its normalised skeleton.
 */
export type Token = { norm: string; surface: string };

function normalizeWord(w: string): string {
  const bare = w.replace(/^'+|'+$/g, "");
  return NUMBERS[bare] ?? bare;
}

/**
 * Applied identically to target and transcript. Chrome typically returns no
 * punctuation and no capitals while Safari sometimes adds both, so normalising
 * both sides is what stops that becoming a score difference.
 */
export function tokenize(text: string): Token[] {
  const cleaned = text
    .normalize("NFKC")
    // Keep apostrophes inside words, drop all other punctuation.
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return [];

  const raw = cleaned.split(" ");
  const out: Token[] = [];

  for (let i = 0; i < raw.length; i++) {
    const word = raw[i]!;
    const lower = word.toLowerCase();

    // Try a two-word contraction first, merging both surfaces.
    if (i + 1 < raw.length) {
      const pair = `${lower} ${raw[i + 1]!.toLowerCase()}`;
      const contracted = CONTRACTIONS[pair];
      if (contracted) {
        out.push({ norm: contracted, surface: `${word} ${raw[i + 1]}` });
        i++;
        continue;
      }
    }

    const single = CONTRACTIONS[lower];
    if (single) {
      out.push({ norm: single, surface: word });
      continue;
    }

    const norm = normalizeWord(lower);
    if (!norm || FILLERS.has(norm)) continue;
    out.push({ norm, surface: word });
  }

  return out;
}

/** Comparison forms only. Kept for callers that just want the word list. */
export function normalize(text: string): string[] {
  return tokenize(text).map((t) => t.norm);
}

/**
 * Folds the consonant substitutions Japanese speakers of English actually make, so
 * light/right, berry/very and think/sink land as "near" rather than "missing".
 * Not Soundex — a general-purpose algorithm blurs distinctions that matter here and
 * misses the ones that don't.
 */
export function phoneticKey(word: string): string {
  let s = word.replace(/'/g, "");
  s = s.replace(/ph/g, "f");
  s = s.replace(/th/g, "s");
  s = s.replace(/sh/g, "s");
  s = s.replace(/ck/g, "k");
  s = s.replace(/c(?=[eiy])/g, "s");
  s = s.replace(/c/g, "k");
  s = s.replace(/q/g, "k");
  s = s.replace(/x/g, "ks");
  s = s.replace(/z/g, "s");
  s = s.replace(/v/g, "b");
  s = s.replace(/l/g, "r");
  s = s.replace(/([a-z])\1+/g, "$1");
  s = s.replace(/e$/, "");
  return s;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** Word similarity in [0,1]: exact, then phonetically equal, then edit distance. */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (phoneticKey(a) === phoneticKey(b)) return 0.9;
  const dist = levenshtein(a, b);
  return Math.max(0, 1 - dist / Math.max(a.length, b.length));
}

const GAP_PENALTY = -0.6;

type Op = { target?: Token; spoken?: Token };

/**
 * Needleman-Wunsch global alignment over word tokens. Global (not local) because
 * two complete sentences are being compared; the traceback is what makes it
 * possible to say *which* word was dropped rather than just how different the
 * strings are.
 */
export function align(target: Token[], spoken: Token[]): Op[] {
  const n = target.length;
  const m = spoken.length;
  const score: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 1; i <= n; i++) score[i]![0] = i * GAP_PENALTY;
  for (let j = 1; j <= m; j++) score[0]![j] = j * GAP_PENALTY;

  const sub = (i: number, j: number) =>
    score[i - 1]![j - 1]! + (2 * wordSimilarity(target[i - 1]!.norm, spoken[j - 1]!.norm) - 1);

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      score[i]![j] = Math.max(sub(i, j), score[i - 1]![j]! + GAP_PENALTY, score[i]![j - 1]! + GAP_PENALTY);
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && score[i]![j] === sub(i, j)) {
      ops.push({ target: target[i - 1], spoken: spoken[j - 1] });
      i--; j--;
    } else if (i > 0 && score[i]![j] === score[i - 1]![j]! + GAP_PENALTY) {
      ops.push({ target: target[i - 1] });
      i--;
    } else {
      ops.push({ spoken: spoken[j - 1] });
      j--;
    }
  }
  return ops.reverse();
}

export function scoreUtterance(targetText: string, transcript: string): ScoreResult {
  const target = tokenize(targetText);
  const spoken = tokenize(transcript);

  if (spoken.length === 0) {
    // A mic failure is not a zero: the caller shows a retry prompt instead.
    return {
      score: 0,
      words: target.map((t) => ({ text: t.surface, status: "missing" as const })),
      empty: true,
    };
  }

  const words: ScoredWord[] = [];
  let hit = 0;
  let nearCount = 0;
  let extras = 0;

  for (const op of align(target, spoken)) {
    if (op.target && op.spoken) {
      const sim = wordSimilarity(op.target.norm, op.spoken.norm);
      if (sim >= 0.85) {
        words.push({ text: op.target.surface, status: "correct" });
        hit += 1;
      } else if (sim >= 0.5) {
        words.push({ text: op.target.surface, status: "near", spoken: op.spoken.surface });
        nearCount += 1;
      } else {
        words.push({ text: op.target.surface, status: "missing", spoken: op.spoken.surface });
        extras += 1;
      }
    } else if (op.target) {
      words.push({ text: op.target.surface, status: "missing" });
    } else if (op.spoken) {
      words.push({ text: op.spoken.surface, status: "extra" });
      extras += 1;
    }
  }

  const base = target.length === 0 ? 0 : (hit + 0.6 * nearCount) / target.length;
  const penalty = Math.min(0.15, 0.05 * extras);
  const score = Math.round(100 * Math.max(0, Math.min(1, base - penalty)));

  return { score, words, empty: false };
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 85) return "great";
  if (score >= 65) return "good";
  return "needsWork";
}

export const BAND_LABEL_JA: Record<ScoreBand, string> = {
  great: "バッチリ！",
  good: "いい感じ",
  needsWork: "もう一度",
};
