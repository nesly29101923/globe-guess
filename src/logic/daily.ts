// Daily systems that are not the streak: login calendar, missions, Daily Challenge generation.
import { balance } from '../config/balance';
import { DAILY_RECIPE, TIER_MIX } from '../config/levels';
import { pool, capitalPool } from '../data/gameData';
import { makeQuestion, pickItems } from './picker';
import { makeRng } from './rng';
import type { MissionState, SaveState } from './save';
import type { Question } from './types';
import { daysBetween } from './time';

// ---------------------------------------------------------------- login calendar

export function canClaimLogin(s: SaveState, day: string): boolean {
  return s.login.lastDay !== day;
}

/** Claim today's login reward. Missing a day pauses the calendar, it never resets it. */
export function claimLogin(s: SaveState, day: string): { state: SaveState; coins: number; dayIndex: number; chest: boolean } {
  if (!canClaimLogin(s, day)) return { state: s, coins: 0, dayIndex: s.login.next, chest: false };
  const cal = balance.daily.loginCalendar;
  const i = s.login.next % cal.length;
  const chest = i === cal.length - 1;
  const coins = cal[i];
  const st = { ...s, coins: s.coins + coins, login: { next: (i + 1) % cal.length, lastDay: day } };
  if (chest) {
    const n = balance.daily.loginDay7Powerups;
    st.powerups = { fiftyFifty: s.powerups.fiftyFifty + n, freeze: s.powerups.freeze + n, skip: s.powerups.skip, secondChance: s.powerups.secondChance };
  }
  return { state: st, coins, dayIndex: i, chest };
}

// ---------------------------------------------------------------- missions

export type MissionDef = { id: string; band: 'easy' | 'medium' | 'push'; target: number; minLevel?: number };

export const MISSION_POOL: MissionDef[] = [
  { id: 'correct_answers', band: 'easy', target: 20 },
  { id: 'play_rounds', band: 'easy', target: 3 },
  { id: 'correct_answers_big', band: 'easy', target: 35 },
  { id: 'three_stars', band: 'medium', target: 1 },
  { id: 'combo', band: 'medium', target: 5 },
  { id: 'discover', band: 'medium', target: 5 },
  { id: 'flags_right', band: 'medium', target: 8 },
  { id: 'daily_challenge', band: 'push', target: 1, minLevel: balance.unlocks.dailyChallenge },
  { id: 'journey_levels', band: 'push', target: 2 },
  { id: 'quick_rounds', band: 'push', target: 2, minLevel: balance.unlocks.quickPlay },
  { id: 'survival_correct', band: 'push', target: 15, minLevel: balance.unlocks.survival },
];

export function missionsForDay(day: string, level: number): MissionState[] {
  const rng = makeRng(`missions:${day}`);
  const out: MissionState[] = [];
  for (const band of ['easy', 'medium', 'push'] as const) {
    const options = MISSION_POOL.filter((m) => m.band === band && (m.minLevel ?? 0) <= level);
    const m = rng.pick(options);
    out.push({ id: m.id, target: m.target, progress: 0, claimed: false });
  }
  return out;
}

export function ensureMissions(s: SaveState, day: string): SaveState {
  if (s.missions.day === day) return s;
  return { ...s, missions: { day, list: missionsForDay(day, s.level), chestClaimed: false } };
}

export type RoundFacts = {
  mode: string; correct: number; flagsCorrect: number; stars: number; maxCombo: number; newCards: number; levelPassed: boolean;
};

export type MissionTick = { id: string; from: number; to: number; target: number; done: boolean };

export function progressMissions(s: SaveState, f: RoundFacts): { state: SaveState; ticks: MissionTick[] } {
  const ticks: MissionTick[] = [];
  const list = s.missions.list.map((m) => {
    if (m.claimed || m.progress >= m.target) return m;
    let add = 0;
    switch (m.id) {
      case 'correct_answers':
      case 'correct_answers_big': add = f.correct; break;
      case 'play_rounds': add = 1; break;
      case 'three_stars': add = f.mode === 'journey' && f.stars >= 3 ? 1 : 0; break;
      case 'combo': add = f.maxCombo >= m.target ? m.target : 0; break;
      case 'discover': add = f.newCards; break;
      case 'flags_right': add = f.flagsCorrect; break;
      case 'daily_challenge': add = f.mode === 'daily' ? 1 : 0; break;
      case 'journey_levels': add = f.mode === 'journey' && f.levelPassed ? 1 : 0; break;
      case 'quick_rounds': add = f.mode === 'quick' ? 1 : 0; break;
      case 'survival_correct': add = f.mode === 'survival' ? f.correct : 0; break;
    }
    if (!add) return m;
    const to = Math.min(m.target, m.progress + add);
    ticks.push({ id: m.id, from: m.progress, to, target: m.target, done: to >= m.target });
    return { ...m, progress: to };
  });
  return { state: { ...s, missions: { ...s.missions, list } }, ticks };
}

export function claimMission(s: SaveState, id: string): { state: SaveState; coins: number } {
  const m = s.missions.list.find((x) => x.id === id);
  if (!m || m.claimed || m.progress < m.target) return { state: s, coins: 0 };
  const coins = balance.daily.missionCoins;
  return {
    state: { ...s, coins: s.coins + coins, missions: { ...s.missions, list: s.missions.list.map((x) => (x.id === id ? { ...x, claimed: true } : x)) } },
    coins,
  };
}

export function canClaimMissionChest(s: SaveState): boolean {
  return !s.missions.chestClaimed && s.missions.list.length > 0 && s.missions.list.every((m) => m.claimed);
}

export function claimMissionChest(s: SaveState): { state: SaveState; coins: number } {
  if (!canClaimMissionChest(s)) return { state: s, coins: 0 };
  const coins = balance.daily.allMissionsChestCoins;
  const n = balance.daily.allMissionsChestPowerups;
  return {
    state: { ...s, coins: s.coins + coins, missions: { ...s.missions, chestClaimed: true },
      powerups: { ...s.powerups, fiftyFifty: s.powerups.fiftyFifty + n } },
    coins,
  };
}

// ---------------------------------------------------------------- Daily Challenge

/** Same 10 questions for everyone on a date: seeded by the date only, never by the player's save. */
export function dailyQuestions(day: string): Question[] {
  const rng = makeRng(`daily:${day}`);
  const qs: Question[] = [];
  const taken = new Set<string>();
  for (const part of DAILY_RECIPE) {
    const p = part.type === 'capital' ? capitalPool(part.topic) : pool(part.topic, part.type !== 'map');
    const ids = new Set(p.map((x) => x.id));
    for (const x of pickItems(p, part.count, TIER_MIX.mixed, rng, {}, taken)) {
      taken.add(x.id);
      qs.push(makeQuestion(x.id, x.tier, part.type, ids, rng));
    }
  }
  const tiers = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];
  return qs.map((q) => ({ q, k: tiers.indexOf(q.tier) + rng.next() * 0.9 })).sort((a, b) => a.k - b.k).map((x) => x.q);
}

export function dailyPlayed(s: SaveState, day: string): boolean {
  return !!s.daily.results[day];
}

/** "Globe Guess Daily 2026-11-15 · 8/10 · 🟩🟩🟥..." (no spoilers). */
export function dailyShareText(appName: string, day: string, correct: number, grid: string, score: number): string {
  return `${appName} · Daily ${day}\n${grid}\n${correct}/10 · ${score.toLocaleString('en-US')} pts`;
}

export function gridFor(results: boolean[]): string {
  return results.map((r) => (r ? '🟩' : '🟥')).join('');
}

export function dailyNumber(day: string, launchDay = '2026-11-01'): number {
  return Math.max(1, daysBetween(launchDay, day) + 1);
}
