import { passcodeHeaders } from "./passcode";
import type {
  CoachNote,
  CoachRequest,
  HealthResponse,
  TutorRequest,
  TutorTurn,
} from "../server/schemas";

/**
 * Typed client for /api/*. Nothing here imports the Anthropic SDK — the key lives
 * only on the server, and the browser bundle has no AI dependency at all.
 */
export class ApiError extends Error {
  constructor(readonly messageJa: string, readonly code: string) {
    super(code);
  }
}

const GENERIC = new ApiError("通信に失敗しました。接続を確認してもう一度お試しください。", "network");

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...passcodeHeaders() },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw GENERIC;
  }

  const data = (await res.json().catch(() => null)) as
    | (T & { code?: string; messageJa?: string })
    | null;

  if (!res.ok) {
    throw new ApiError(
      data?.messageJa ?? "エラーが発生しました。もう一度お試しください。",
      data?.code ?? `http_${res.status}`,
    );
  }
  if (!data) throw GENERIC;
  return data;
}

export function fetchTutorTurn(req: TutorRequest, signal?: AbortSignal): Promise<TutorTurn> {
  return post<TutorTurn>("/api/tutor", req, signal);
}

export function fetchCoachNote(req: CoachRequest, signal?: AbortSignal): Promise<CoachNote> {
  return post<CoachNote>("/api/coach", req, signal);
}

export async function fetchHealth(): Promise<HealthResponse> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw GENERIC;
    return (await res.json()) as HealthResponse;
  } catch {
    // Unreachable API: assume mock, no gate, so the app still renders.
    return { ok: true, aiEnabled: false, passcodeRequired: false };
  }
}

/** Validates an access code against the server without running an AI request. */
export async function verifyPasscode(code: string): Promise<boolean> {
  try {
    const res = await fetch("/api/verify", { headers: { "x-aitalk-pass": code } });
    return res.ok;
  } catch {
    return false;
  }
}
