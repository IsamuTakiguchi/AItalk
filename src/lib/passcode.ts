/**
 * Access-code storage for deployments that set DEMO_PASSCODE.
 *
 * A public deployment is a proxy to a paid API key, so the server can require
 * an `x-aitalk-pass` header on the AI routes. The code is a shared gate for a
 * demo, not a user credential — it identifies nobody and grants nothing beyond
 * use of this app's own endpoints.
 */
const KEY = "aitalk.passcode";

export function getPasscode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setPasscode(code: string): void {
  try {
    localStorage.setItem(KEY, code.trim());
  } catch { /* blocked storage: the header just won't persist */ }
}

export function clearPasscode(): void {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing to do */ }
}

export function passcodeHeaders(): Record<string, string> {
  const code = getPasscode();
  return code ? { "x-aitalk-pass": code } : {};
}
