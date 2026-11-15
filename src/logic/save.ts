// The player's save. Versioned and migrated: an update must never lose progress, coins or a streak.
import { balance } from '../config/balance';

export const SAVE_VERSION = 2;

export type PowerupId = 'fiftyFifty' | 'freeze' | 'skip' | 'secondChance';

export type MissionState = { id: string; target: number; progress: number; claimed: boolean };

export type SaveState = {
  version: number;
  createdAt: number;
  coins: number;
  xp: number;            // XP inside the current level
  level: number;
  powerups: Record<PowerupId, number>;
  ftue: { firstRoundDone: boolean; secondRoundDone: boolean; homeSeen: boolean };
  totalRounds: number;
  sessions: number;
  journey: { stars: Record<string, number>; bossesCleared: string[]; chaptersCompleted: string[] };
  replays: { day: string; count: number };
  hearts: { count: number; since: number };
  atlas: Record<string, { days: string[] }>;       // "country:FR" -> distinct days with a right answer
  regionsCompleted: string[];
  recent: Record<string, string[]>;
  missed: string[];
  streak: { count: number; best: number; lastDay: string | null; freezes: number; milestones: number[];
    broken: { count: number; day: string } | null; freezeUsedDay: string | null };
  login: { next: number; lastDay: string | null };
  missions: { day: string | null; list: MissionState[]; chestClaimed: boolean };
  daily: { results: Record<string, { score: number; correct: number; grid: string }> };
  best: Record<string, number>;
  cosmetics: { owned: string[]; mapTheme: string; buttonStyle: string; title: string | null; titles: string[] };
  settings: { sound: boolean; music: boolean; haptics: boolean; notifications: boolean };
  ads: { removed: boolean; removedUntil: number; lastInterstitialAt: number; roundsSinceInterstitial: number;
    freeCoins: { day: string | null; count: number } };
  shop: { starterBought: boolean; starterShownDay: string | null };
  stats: { correct: number; answered: number; perfectRounds: number; bestCombo: number; survivalBest: number };
  taught: Record<string, boolean>;
  prompts: { notifications: 'never' | 'asked'; tracking: 'never' | 'asked' };
};

export function newSave(now: number): SaveState {
  return {
    version: SAVE_VERSION,
    createdAt: now,
    coins: balance.start.coins,
    xp: 0,
    level: 1,
    powerups: { ...balance.start.powerups },
    ftue: { firstRoundDone: false, secondRoundDone: false, homeSeen: false },
    totalRounds: 0,
    sessions: 0,
    journey: { stars: {}, bossesCleared: [], chaptersCompleted: [] },
    replays: { day: '', count: 0 },
    hearts: { count: balance.hearts.max, since: now },
    atlas: {},
    regionsCompleted: [],
    recent: {},
    missed: [],
    streak: { count: 0, best: 0, lastDay: null, freezes: 0, milestones: [], broken: null, freezeUsedDay: null },
    login: { next: 0, lastDay: null },
    missions: { day: null, list: [], chestClaimed: false },
    daily: { results: {} },
    best: {},
    cosmetics: { owned: ['classic', 'btn_classic'], mapTheme: 'classic', buttonStyle: 'btn_classic', title: null, titles: [] },
    settings: { sound: true, music: false, haptics: true, notifications: true },
    ads: { removed: false, removedUntil: 0, lastInterstitialAt: 0, roundsSinceInterstitial: 0, freeCoins: { day: null, count: 0 } },
    shop: { starterBought: false, starterShownDay: null },
    stats: { correct: 0, answered: 0, perfectRounds: 0, bestCombo: 0, survivalBest: 0 },
    taught: {},
    prompts: { notifications: 'never', tracking: 'never' },
  };
}

type Migration = (s: Record<string, unknown>) => Record<string, unknown>;

/** migrations[v] turns a version-v save into version v+1. Never remove one. */
const migrations: Record<number, Migration> = {
  // v1 had no hearts.since and kept survival best at the top level.
  1: (s) => {
    const hearts = (s.hearts as { count?: number } | undefined) ?? {};
    const stats = (s.stats as Record<string, number> | undefined) ?? {};
    return {
      ...s,
      hearts: { count: hearts.count ?? balance.hearts.max, since: Date.now() },
      stats: { ...stats, survivalBest: (s.survivalBest as number | undefined) ?? stats.survivalBest ?? 0 },
      version: 2,
    };
  },
};

/** Fill any missing field from a fresh save, deeply, so older saves keep their values and gain new ones. */
function fill<T>(base: T, data: unknown): T {
  if (data === undefined || data === null) return base;
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return data as T;
  if (typeof data !== 'object' || Array.isArray(data)) return base;
  const out: Record<string, unknown> = { ...(data as Record<string, unknown>) };
  for (const [k, v] of Object.entries(base as Record<string, unknown>)) {
    out[k] = fill(v, (data as Record<string, unknown>)[k]);
  }
  return out as T;
}

export function migrate(raw: unknown, now: number): SaveState {
  if (!raw || typeof raw !== 'object') return newSave(now);
  let s = { ...(raw as Record<string, unknown>) };
  let v = typeof s.version === 'number' ? s.version : 1;
  while (v < SAVE_VERSION) {
    const m = migrations[v];
    if (m) s = m(s);
    v += 1;
    s.version = v;
  }
  const filled = fill(newSave(now), s);
  filled.version = SAVE_VERSION;
  return filled;
}
