import type { CoachNote, CoachRequest, Correction, TutorRequest, TutorTurn } from "./schemas";

/**
 * Deterministic stand-ins used when no ANTHROPIC_API_KEY is configured, so the
 * whole app is clickable straight after `npm install`. Same shapes as the real
 * calls, so no UI branches on mock vs real beyond a banner.
 */

/** Patterns a Japanese learner actually produces, so the demo shows real corrections. */
const CORRECTION_RULES: { test: RegExp; build: (m: RegExpMatchArray) => Correction }[] = [
  {
    test: /\byesterday i (go|eat|see|meet|do)\b/i,
    build: (m) => ({
      original: `yesterday I ${m[1]}`,
      corrected: `yesterday I ${{ go: "went", eat: "ate", see: "saw", meet: "met", do: "did" }[m[1]!.toLowerCase()] ?? m[1]}`,
      reasonJa:
        "「yesterday」のように過去を表す語があるときは、動詞も過去形にします。日本語では「昨日、行く」と言わないのと同じ感覚です。",
      kind: "grammar",
    }),
  },
  {
    test: /\bi am (agree|disagree)\b/i,
    build: (m) => ({
      original: `I am ${m[1]}`,
      corrected: `I ${m[1]!.toLowerCase()}`,
      reasonJa:
        "「agree」はそれ自体が動詞なので、be動詞は付けません。「私は賛成です」を直訳すると be 動詞を入れてしまいがちな、とてもよくある間違いです。",
      kind: "grammar",
    }),
  },
  {
    test: /\bi have (\d+) years? old\b/i,
    build: (m) => ({
      original: `I have ${m[1]} years old`,
      corrected: `I'm ${m[1]} years old`,
      reasonJa: "年齢は have ではなく be動詞で表します。「〜歳です」は I'm 〜 years old が自然です。",
      kind: "grammar",
    }),
  },
  {
    test: /\bvery (like|want)\b/i,
    build: (m) => ({
      original: `very ${m[1]}`,
      corrected: `really ${m[1]}`,
      reasonJa:
        "very は形容詞や副詞を強めますが、動詞は強められません。動詞を強めるときは really を使います。",
      kind: "naturalness",
    }),
  },
  {
    test: /\bplease teach me\b/i,
    build: () => ({
      original: "please teach me",
      corrected: "could you tell me",
      reasonJa:
        "teach は「技能や科目を教える」意味です。情報を尋ねるときは tell を使うほうが自然です。「教えてください」の直訳に注意しましょう。",
      kind: "vocabulary",
    }),
  },
];

function findCorrections(text: string): Correction[] {
  const out: Correction[] = [];
  for (const rule of CORRECTION_RULES) {
    const m = text.match(rule.test);
    if (m) out.push(rule.build(m));
    if (out.length >= 2) break;
  }
  return out;
}

const FREETALK_REPLIES = [
  { reply: "That's interesting. How long have you been doing that?", replyJa: "それは面白いですね。どのくらい続けているんですか？" },
  { reply: "Nice! And what do you like most about it?", replyJa: "いいですね！その中で一番好きなところは何ですか？" },
  { reply: "I see. Can you tell me a bit more about that?", replyJa: "なるほど。もう少し詳しく教えてもらえますか？" },
  { reply: "That makes sense. What would you do differently next time?", replyJa: "わかります。次はどうしたいですか？" },
];

const ROLEPLAY_REPLIES = [
  { reply: "Of course. Anything else I can get for you?", replyJa: "もちろんです。ほかに何かご用はありますか？" },
  { reply: "Sure, no problem. Could you tell me your name, please?", replyJa: "はい、大丈夫です。お名前を伺えますか？" },
  { reply: "Certainly. Would you like anything to drink with that?", replyJa: "承知しました。お飲み物はいかがですか？" },
  { reply: "All set. Is there anything you'd like to ask me?", replyJa: "準備できました。何か聞きたいことはありますか？" },
];

const SUGGESTIONS: Record<string, string[]> = {
  freetalk: ["I've been doing it for about two years.", "Actually, I just started last month.", "It's my first time, so I'm still learning."],
  roleplay: ["Yes, that would be great, thank you.", "No thanks, that's everything.", "Sorry, could you say that again?"],
};

export function mockTutorTurn(req: TutorRequest): TutorTurn {
  const pool = req.mode === "roleplay" ? ROLEPLAY_REPLIES : FREETALK_REPLIES;
  // Advance through the pool by turn count so a conversation doesn't repeat itself.
  const pick = pool[Math.floor(req.history.length / 2) % pool.length]!;
  const corrections = findCorrections(req.userText);
  const words = req.userText.trim().split(/\s+/).filter(Boolean).length;

  return {
    reply: pick.reply,
    replyJa: pick.replyJa,
    corrections,
    suggestions: SUGGESTIONS[req.mode]!,
    // Longer answers with no detected mistakes score better — enough signal to
    // exercise the UI without pretending to be a real judgement.
    expressionScore: Math.max(40, Math.min(95, 70 + Math.min(words, 12) * 2 - corrections.length * 15)),
  };
}

export function mockCoachNote(req: CoachRequest): CoachNote {
  return {
    titleJa: "よくある言い換えのポイント",
    explanationJa:
      `「${req.original}」は意味は伝わりますが、英語としては「${req.corrected}」のほうが自然です。`
      + "日本語からそのまま置き換えると語順や動詞の選び方がずれることがあります。"
      + "（これはモックモードの解説です。ANTHROPIC_API_KEY を設定すると、AI講師による詳しい解説が表示されます。）",
    examples: [
      { en: req.corrected, ja: "添削後の英文です。" },
      { en: "Could you say that again, please?", ja: "もう一度言っていただけますか？" },
    ],
  };
}
