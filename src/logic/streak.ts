// Streak: a day counts when the player finishes one round of anything. Streak Freezes save a missed day
// automatically (relief moment). After a break, a one-time repair is offered the next day.
import { balance } from '../config/balance';
import type { SaveState } from './save';
import { daysBetween } from './time';

export type StreakEvent =
  | { kind: 'started'; count: number }
  | { kind: 'extended'; count: number }
  | { kind: 'froze'; used: number; count: number }
  | { kind: 'broken'; lost: number; count: number }
  | { kind: 'same_day'; count: number };

export type StreakMilestone = { days: number; coins: number; title: string | null };

/** Called when a round is finished on `day`. */
export function onRoundFinished(s: SaveState, day: string): { state: SaveState; ev: StreakEvent; milestone: StreakMilestone | null } {
  const st = { ...s, streak: { ...s.streak, milestones: [...s.streak.milestones] } };
  const k = st.streak;
  let ev: StreakEvent;
  if (k.lastDay === day) {
    return { state: s, ev: { kind: 'same_day', count: k.count }, milestone: null };
  }
  if (!k.lastDay || k.count === 0) {
    k.count = 1;
    ev = { kind: 'started', count: 1 };
  } else {
    const gap = daysBetween(k.lastDay, day);
    if (gap <= 0) {
      // clock set back: never punish, never double count
      return { state: s, ev: { kind: 'same_day', count: k.count }, milestone: null };
    }
    const missed = gap - 1;
    if (missed === 0) {
      k.count += 1;
      ev = { kind: 'extended', count: k.count };
    } else if (missed <= k.freezes) {
      k.freezes -= missed;
      k.count += 1;
      k.freezeUsedDay = day;
      ev = { kind: 'froze', used: missed, count: k.count };
    } else {
      k.broken = { count: k.count, day };
      ev = { kind: 'broken', lost: k.count, count: 1 };
      k.count = 1;
      k.milestones = [];
    }
  }
  k.lastDay = day;
  k.best = Math.max(k.best, k.count);
  const milestone = claimMilestone(st);
  return { state: st, ev, milestone };
}

function claimMilestone(st: SaveState): StreakMilestone | null {
  const { streakMilestones, streakMilestoneCoins, streakTitleFrom } = balance.daily;
  const i = streakMilestones.indexOf(st.streak.count as (typeof streakMilestones)[number]);
  if (i < 0 || st.streak.milestones.includes(st.streak.count)) return null;
  st.streak.milestones.push(st.streak.count);
  const coins = streakMilestoneCoins[i];
  st.coins += coins;
  const title = st.streak.count >= streakTitleFrom ? `streak_${st.streak.count}` : null;
  if (title && !st.cosmetics.titles.includes(title)) st.cosmetics = { ...st.cosmetics, titles: [...st.cosmetics.titles, title] };
  return { days: st.streak.count, coins, title };
}

/** A repair is offered the day a streak broke (the first round after the break). */
export function canRepair(s: SaveState, day: string): boolean {
  return !!s.streak.broken && s.streak.broken.day === day && s.streak.broken.count >= 2;
}

export function repair(s: SaveState): SaveState {
  if (!s.streak.broken) return s;
  const count = s.streak.broken.count + s.streak.count;
  return { ...s, streak: { ...s.streak, count, best: Math.max(s.streak.best, count), broken: null } };
}

/** Is the streak at risk today (played yesterday, not yet today)? */
export function streakAtRisk(s: SaveState, day: string): boolean {
  return !!s.streak.lastDay && s.streak.count > 0 && daysBetween(s.streak.lastDay, day) === 1;
}

/** The streak as it would show today (0 if it already broke and no freeze covers it). */
export function displayedStreak(s: SaveState, day: string): number {
  if (!s.streak.lastDay) return 0;
  const gap = daysBetween(s.streak.lastDay, day);
  if (gap <= 1) return s.streak.count;
  return gap - 1 <= s.streak.freezes ? s.streak.count : 0;
}
