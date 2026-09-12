import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  CoachNoteSchema,
  TutorTurnSchema,
  clampScore,
  type CoachNote,
  type CoachRequest,
  type TutorRequest,
  type TutorTurn,
} from "./schemas";
import { STABLE_COACH_SYSTEM, STABLE_TUTOR_SYSTEM, buildVolatileContext } from "./prompts";

export const MODEL_ID = "claude-opus-5";

/**
 * `max_tokens` caps thinking *and* visible output combined, so it stays generous
 * even though the JSON payload itself is small. Trimming this to "about the size
 * of the response" is what causes truncated output on a thinking model.
 */
const MAX_TOKENS = 16000;

/** Raised for conditions the route should turn into a specific HTTP status. */
export class AiError extends Error {
  constructor(
    readonly status: number,
    readonly messageJa: string,
    readonly code: string,
  ) {
    super(code);
  }
}

const BUSY = new AiError(429, "いま混み合っています。少し待ってからもう一度お試しください。", "rate_limited");
const REFUSED = new AiError(400, "この内容にはお答えできません。別の話題でもう一度お試しください。", "refused");
const BROKEN = new AiError(502, "AI講師との通信に失敗しました。もう一度お試しください。", "upstream_error");

function client(apiKey: string): Anthropic {
  // Constructed per request: Workers isolates must not hold cross-request state.
  return new Anthropic({ apiKey, maxRetries: 1 });
}

/**
 * Shared guard chain. A structured-output response is only trustworthy once all
 * three of these have passed — `parsed_output` is `null` on a validation failure
 * rather than throwing, so an unchecked read silently yields undefined fields.
 */
function unwrap<T>(res: {
  stop_reason: string | null;
  parsed_output: T | null;
}): T {
  if (res.stop_reason === "refusal") throw REFUSED;
  if (res.stop_reason === "max_tokens") throw BROKEN;
  if (res.parsed_output == null) throw BROKEN;
  return res.parsed_output;
}

function translateError(err: unknown): never {
  if (err instanceof AiError) throw err;
  if (err instanceof Anthropic.RateLimitError) throw BUSY;
  if (err instanceof Anthropic.AuthenticationError) {
    // The key is present but rejected. Surfaced distinctly so the route can fall
    // back to mock rather than showing the learner a dead end.
    throw new AiError(503, "AI講師に接続できません。", "bad_credentials");
  }
  if (err instanceof Anthropic.APIError) throw BROKEN;
  throw BROKEN;
}

export async function runTutorTurn(req: TutorRequest, apiKey: string): Promise<TutorTurn> {
  try {
    const res = await client(apiKey).messages.parse({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: [
        // Stable first so it can be cached; volatile context strictly after it.
        { type: "text", text: STABLE_TUTOR_SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: buildVolatileContext(req) },
      ],
      messages: [
        ...req.history.map((m) => ({ role: m.role, content: m.content }) as const),
        { role: "user" as const, content: req.userText },
      ],
      output_config: { effort: "low", format: zodOutputFormat(TutorTurnSchema) },
    });

    const turn = unwrap(res);
    return { ...turn, expressionScore: clampScore(turn.expressionScore) };
  } catch (err) {
    translateError(err);
  }
}

export async function runCoachNote(req: CoachRequest, apiKey: string): Promise<CoachNote> {
  try {
    const res = await client(apiKey).messages.parse({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system: [{ type: "text", text: STABLE_COACH_SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `学習者が言った英文: "${req.original}"\n添削後の英文: "${req.corrected}"`,
        },
      ],
      output_config: { effort: "low", format: zodOutputFormat(CoachNoteSchema) },
    });
    return unwrap(res);
  } catch (err) {
    translateError(err);
  }
}
