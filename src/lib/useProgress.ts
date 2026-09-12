import { useCallback, useSyncExternalStore } from "react";
import { loadProgress, saveProgress, type Progress } from "./progress";

/**
 * A tiny external store rather than Context: progress is written from deep inside
 * lesson flows and read by the header on every screen, and `useSyncExternalStore`
 * gives that without a provider or a state library. The `storage` listener keeps
 * two open tabs consistent.
 */
let state: Progress = loadProgress();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

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
}

export function updateProgress(fn: (p: Progress) => Progress): void {
  setProgress(fn(state));
}

/** Current value without subscribing — for use inside event handlers. */
export function readProgress(): Progress {
  return state;
}

export function reloadFromStorage(): void {
  state = loadProgress();
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === "aitalk.progress.v1") reloadFromStorage();
  });
}

export function useProgress(): [Progress, (fn: (p: Progress) => Progress) => void] {
  const progress = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const update = useCallback((fn: (p: Progress) => Progress) => updateProgress(fn), []);
  return [progress, update];
}
