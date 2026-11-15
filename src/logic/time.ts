/** Day keys in the player's local time. The clock is always passed in (tests move it). */
export type Clock = () => number;
export const systemClock: Clock = () => Date.now();

/** "YYYY-MM-DD" for the local day of `now`. offsetMin = minutes east of UTC (defaults to the device zone). */
export function dayKey(now: number, offsetMin?: number): string {
  const off = offsetMin ?? -new Date(now).getTimezoneOffset();
  const d = new Date(now + off * 60000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/** Whole days from a to b (b later = positive). */
export function daysBetween(a: string, b: string): number {
  return dayNumber(b) - dayNumber(a);
}

/** Milliseconds until the next local midnight. */
export function msToMidnight(now: number, offsetMin?: number): number {
  const off = offsetMin ?? -new Date(now).getTimezoneOffset();
  const local = now + off * 60000;
  const next = Math.floor(local / 86400000 + 1) * 86400000;
  return next - local;
}
