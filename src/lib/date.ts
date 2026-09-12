/**
 * Day keys are always local-time `YYYY-MM-DD`.
 *
 * `toISOString()` is deliberately not used anywhere here: it returns UTC, which in
 * Japan would roll the "day" over at 09:00 local time and break streaks for anyone
 * studying in the morning.
 */
const pad = (n: number) => String(n).padStart(2, "0");

export function dayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Whole days from `a` to `b`, both local day keys. Compared through `Date.UTC` so
 * a DST shift can't make two calendar days differ by 0 or 2.
 */
export function daysBetween(a: string, b: string): number {
  const toUtc = (key: string) => {
    const [y, m, d] = key.split("-").map(Number);
    return Date.UTC(y!, m! - 1, d!);
  };
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dayKey(new Date(y!, m! - 1, d! + days));
}

/** Current UTC offset in minutes, stored so timezone travel can be detected. */
export function tzOffsetMin(): number {
  return new Date().getTimezoneOffset();
}

/** The last `count` day keys, oldest first — used by the weekly activity bars. */
export function recentDays(count: number): string[] {
  const today = dayKey();
  return Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
}

export function weekdayJa(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return ["日", "月", "火", "水", "木", "金", "土"][new Date(y!, m! - 1, d!).getDay()]!;
}
