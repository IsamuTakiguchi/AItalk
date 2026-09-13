import { useCallback, useSyncExternalStore } from "react";
import { applyServerProgress } from "./mergeProgress";
import { fetchServerProgress, saveServerProgress } from "./progressApi";
import { loadProgress, saveProgress, type Progress } from "./progress";

/**
 * A tiny external store rather than Context: progress is written from deep inside
 * lesson flows and read by the header on every screen, and `useSyncExternalStore`
 * gives that without a provider or a state library. The `storage` listener keeps
 * two open tabs consistent.
 *
 * Because every write in the app funnels through `setProgress`, server sync is
 * added here once and no screen needs to know about it.
 */
let state: Progress = loadProgress();
const listeners = new Set<() => void>();

/** Off until the session is known, so a signed-out visitor writes nothing. */
let syncEnabled = false;

export type SyncStatus = "idle" | "saving" | "offline";
let syncStatus: SyncStatus = "idle";
const syncListeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function emitSync(next: SyncStatus): void {
  syncStatus = next;
  for (const l of syncListeners) l();
}

// --- debounced write-through ------------------------------------------------

/**
 * Saves are debounced because a single slider drag produces dozens of updates.
 * The trailing edge is what matters: the last state within the window is the one
 * that reaches the server, and merge semantics make an interrupted sequence
 * harmless.
 */
const SAVE_DEBOUNCE_MS = 1500;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pending = false;

async function flush(): Promise<void> {
  if (!syncEnabled || !pending) return;
  pending = false;
  emitSync("saving");
  const saved = await saveServerProgress(state).catch(() => null);
  if (saved) {
    // Adopt the merged result so this device converges with the other ones.
    state = applyServerProgress(state, saved);
    saveProgress(state);
    emit();
    emitSync("idle");
  } else {
    // Keep the local copy; it will be merged in on the next successful save.
    pending = true;
    emitSync("offline");
  }
}

function scheduleSave(): void {
  if (!syncEnabled) return;
  pending = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flush(), SAVE_DEBOUNCE_MS);
}

// --- store ------------------------------------------------------------------

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Progress {
  return state;
}

export function setProgress(next: Progress): void {
  state = next;
  saveProgress(next);
  emit();
  scheduleSave();
}

export function updateProgress(fn: (p: Progress) => Progress): void {
  setProgress(fn(state));
}

/** Current value without subscribing — for use inside event handlers. */
export function readProgress(): Progress {
  return state;
}

/** Writes without syncing — used when the server is already the source. */
function setLocalOnly(next: Progress): void {
  state = next;
  saveProgress(next);
  emit();
}

/**
 * Called once after sign-in.
 *
 * Merges whatever this device has into whatever the account has. That covers the
 * three cases without branching: a new account adopts the device's history, a
 * new device adopts the account's, and a device that has been used offline
 * contributes its work without double-counting.
 */
export async function hydrateFromServer(): Promise<void> {
  syncEnabled = true;
  const server = await fetchServerProgress().catch(() => null);
  if (server) setLocalOnly(applyServerProgress(state, server));
  // Push the merged result back so the account reflects this device's history.
  pending = true;
  await flush();
}

/** Stops syncing and clears in-memory state on sign-out. */
export function stopSync(): void {
  syncEnabled = false;
  pending = false;
  if (saveTimer) clearTimeout(saveTimer);
}

/** Replaces the account's progress outright — for reset and file import only. */
export async function replaceServerProgress(next: Progress): Promise<void> {
  setLocalOnly(next);
  if (!syncEnabled) return;
  emitSync("saving");
  const saved = await saveServerProgress(next, "replace").catch(() => null);
  emitSync(saved ? "idle" : "offline");
}

export function reloadFromStorage(): void {
  state = loadProgress();
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "aitalk.progress.v1") reloadFromStorage();
  });
  // A pending save must not be lost when the app is backgrounded or closed.
  // `visibilitychange` is the reliable signal on mobile; `pagehide` covers the
  // rest. `beforeunload` is deliberately not used — it never fires on iOS.
  const flushNow = () => {
    if (saveTimer) clearTimeout(saveTimer);
    void flush();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushNow();
  });
  window.addEventListener("pagehide", flushNow);
  window.addEventListener("online", flushNow);
}

export function useProgress(): [Progress, (fn: (p: Progress) => Progress) => void] {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const update = useCallback((fn: (p: Progress) => Progress) => updateProgress(fn), []);
  return [progress, update];
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      syncListeners.add(l);
      return () => syncListeners.delete(l);
    },
    () => syncStatus,
    () => syncStatus,
  );
}
