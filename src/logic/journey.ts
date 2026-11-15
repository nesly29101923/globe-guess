import { balance } from '../config/balance';
import { CHAPTERS, LEVELS, LEVEL_BY_ID, type LevelDef } from '../config/levels';
import type { SaveState } from './save';

export function totalStars(s: SaveState): number {
  return Object.values(s.journey.stars).reduce((a, b) => a + b, 0);
}

export function chapterStars(s: SaveState, chapterId: string): { have: number; max: number } {
  const ls = LEVELS.filter((l) => l.chapter === chapterId);
  return { have: ls.reduce((a, l) => a + (s.journey.stars[l.id] ?? 0), 0), max: ls.length * 3 };
}

export type ChapterLock = { open: boolean; needStars: number; needBoss: string | null };

export function chapterLock(s: SaveState, chapterIndex: number): ChapterLock {
  const c = CHAPTERS[chapterIndex];
  if (chapterIndex === 0) return { open: true, needStars: 0, needBoss: null };
  const prev = CHAPTERS[chapterIndex - 1];
  const prevBoss = LEVELS.filter((l) => l.chapter === prev.id).slice(-1)[0];
  const bossOk = (s.journey.stars[prevBoss.id] ?? 0) > 0;
  const stars = totalStars(s);
  return { open: bossOk && stars >= c.starsToOpen, needStars: Math.max(0, c.starsToOpen - stars), needBoss: bossOk ? null : prevBoss.id };
}

export function isLevelOpen(s: SaveState, l: LevelDef): boolean {
  if (!chapterLock(s, l.chapterIndex).open) return false;
  if (l.globalIndex === 0) return true;
  const prev = LEVELS[l.globalIndex - 1];
  return (s.journey.stars[prev.id] ?? 0) > 0;
}

/** The level the Journey points at: the first open level without a star, else the last open level. */
export function currentLevel(s: SaveState): LevelDef {
  let last = LEVELS[0];
  for (const l of LEVELS) {
    if (!isLevelOpen(s, l)) break;
    last = l;
    if (!s.journey.stars[l.id]) return l;
  }
  return last;
}

export function nextLevelAfter(s: SaveState, id: string): LevelDef | null {
  const l = LEVEL_BY_ID[id];
  const n = LEVELS[l.globalIndex + 1];
  return n && isLevelOpen(s, n) ? n : null;
}

// ---------------------------------------------------------------- hearts

/** Hearts after regeneration at `now`. One comes back every refillMinutes. */
export function heartsNow(s: SaveState, now: number): { count: number; since: number; nextInMs: number } {
  const { max, refillMinutes } = balance.hearts;
  const per = refillMinutes * 60000;
  let { count, since } = s.hearts;
  if (count >= max) return { count: max, since: now, nextInMs: 0 };
  if (now < since) since = now; // clock set back
  const gained = Math.floor((now - since) / per);
  count = Math.min(max, count + gained);
  since = count >= max ? now : since + gained * per;
  return { count, since, nextInMs: count >= max ? 0 : per - (now - since) };
}

export function syncHearts(s: SaveState, now: number): SaveState {
  const h = heartsNow(s, now);
  if (h.count === s.hearts.count && h.since === s.hearts.since) return s;
  return { ...s, hearts: { count: h.count, since: h.since } };
}

export function loseHeart(s: SaveState, now: number): SaveState {
  if (!balance.hearts.enabled) return s;
  const h = heartsNow(s, now);
  const count = Math.max(0, h.count - 1);
  return { ...s, hearts: { count, since: h.count >= balance.hearts.max ? now : h.since } };
}

export function canPlayJourney(s: SaveState, now: number): boolean {
  return !balance.hearts.enabled || heartsNow(s, now).count > 0;
}

export function refillHearts(s: SaveState, now: number, n: number = balance.hearts.max): SaveState {
  const h = heartsNow(s, now);
  return { ...s, hearts: { count: Math.min(balance.hearts.max, h.count + n), since: now } };
}

/** "N more stars to open <chapter>" for the next locked chapter, if any. */
export function nextChapterGoal(s: SaveState): { chapterIndex: number; needStars: number; needBoss: string | null } | null {
  for (let i = 1; i < CHAPTERS.length; i++) {
    const lock = chapterLock(s, i);
    if (!lock.open) return { chapterIndex: i, ...lock };
  }
  return null;
}
