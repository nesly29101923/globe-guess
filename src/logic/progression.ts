import { balance, XP_TABLE, type LevelReward } from '../config/balance';
import type { PowerupId, SaveState } from './save';

export type LevelUp = { level: number; coins: number; unlocks: string[]; reward: LevelReward };

export function xpToNext(level: number): number {
  return XP_TABLE[Math.min(level, XP_TABLE.length - 1)];
}

export function rewardAt(level: number): LevelReward {
  return balance.levelRewards[level] ?? {};
}

export function unlocksAt(level: number): string[] {
  const u = rewardAt(level).unlock;
  return u ? [u] : [];
}

/** The next level that brings something besides coins, and what. */
export function nextReward(level: number): { level: number; reward: LevelReward } | null {
  for (let l = level + 1; l <= balance.xp.maxLevel; l++) {
    const r = rewardAt(l);
    if (Object.keys(r).length) return { level: l, reward: r };
  }
  return null;
}

export function isUnlocked(s: SaveState, what: keyof typeof balance.unlocks): boolean {
  return s.level >= balance.unlocks[what];
}

function grant(st: SaveState, r: LevelReward): SaveState {
  let s = st;
  if (r.coins) s = { ...s, coins: s.coins + r.coins };
  if (r.powerups) {
    const p = { ...s.powerups };
    for (const [k, v] of Object.entries(r.powerups)) p[k as PowerupId] += v ?? 0;
    s = { ...s, powerups: p };
  }
  if (r.cosmetic && !s.cosmetics.owned.includes(r.cosmetic)) s = { ...s, cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, r.cosmetic] } };
  if (r.title && !s.cosmetics.titles.includes(`level_${r.title}`)) {
    const titles = [...s.cosmetics.titles, `level_${r.title}`];
    s = { ...s, cosmetics: { ...s.cosmetics, titles, title: `level_${r.title}` } };
  }
  if (r.streakFreeze) s = { ...s, streak: { ...s.streak, freezes: Math.min(balance.daily.streakFreezeMax, s.streak.freezes + r.streakFreeze) } };
  return s;
}

/** Add XP, roll over levels; each level-up pays coins plus that level's reward. */
export function addXp(s: SaveState, amount: number): { state: SaveState; ups: LevelUp[] } {
  let st = { ...s };
  let xp = st.xp + Math.round(amount);
  let level = st.level;
  const ups: LevelUp[] = [];
  while (level < balance.xp.maxLevel && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    const reward = rewardAt(level);
    ups.push({ level, coins: balance.rewards.levelUpCoins, unlocks: unlocksAt(level), reward });
    st = grant(st, reward);
  }
  st.xp = xp;
  st.level = level;
  st.coins += ups.length * balance.rewards.levelUpCoins;
  return { state: st, ups };
}

/** Total XP needed to reach a level from level 1 (for the sim). */
export function totalXpTo(level: number): number {
  let t = 0;
  for (let l = 1; l < level; l++) t += xpToNext(l);
  return t;
}
