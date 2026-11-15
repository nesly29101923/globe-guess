import { balance, XP_TABLE } from '../config/balance';
import type { SaveState } from './save';

export type LevelUp = { level: number; coins: number; unlocks: string[] };

export function xpToNext(level: number): number {
  return XP_TABLE[Math.min(level, XP_TABLE.length - 1)];
}

export function unlocksAt(level: number): string[] {
  const u = balance.unlocks;
  const out: string[] = [];
  if (level === u.dailyChallenge) out.push('daily');
  if (level === u.quickPlay) out.push('quick');
  if (level === u.survival) out.push('survival');
  return out;
}

export function isUnlocked(s: SaveState, what: keyof typeof balance.unlocks): boolean {
  return s.level >= balance.unlocks[what];
}

/** Add XP, roll over levels; each level-up pays coins. Mutates a copy and returns it. */
export function addXp(s: SaveState, amount: number): { state: SaveState; ups: LevelUp[] } {
  const st = { ...s };
  let xp = st.xp + Math.round(amount);
  let level = st.level;
  const ups: LevelUp[] = [];
  while (level < balance.xp.maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    ups.push({ level, coins: balance.rewards.levelUpCoins, unlocks: unlocksAt(level) });
  }
  st.xp = xp;
  st.level = level;
  st.coins += ups.reduce((a, u) => a + u.coins, 0);
  return { state: st, ups };
}

/** Total XP needed to reach a level from level 1 (for the sim). */
export function totalXpTo(level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}
