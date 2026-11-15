// Scoring and the end of a round: every reward is computed here (pure), the result screen only plays it.
import { balance, softCap } from '../config/balance';
import { CHAPTERS, LEVEL_BY_ID } from '../config/levels';
import { cardKindFor, newlyCompletedRegions, recordCorrect, type CardEvent } from './atlas';
import { progressMissions, type MissionTick } from './daily';
import { loseHeart } from './journey';
import { addXp, type LevelUp } from './progression';
import type { SaveState } from './save';
import { onRoundFinished, type StreakEvent, type StreakMilestone } from './streak';
import type { Answer, Mode } from './types';

const R = balance.round;

export function comboMultiplier(streakOfRight: number): number {
  return Math.max(1, Math.min(R.comboCap, streakOfRight));
}

/** Score for one answer: base x combo + speed bonus (up to 50). */
export function scoreFor(correct: boolean, timeLeftFrac: number, combo: number): number {
  if (!correct) return 0;
  const speed = Math.round(R.speedBonusMax * Math.max(0, Math.min(1, timeLeftFrac)));
  return R.scoreBase * comboMultiplier(combo) + speed;
}

export function starsFor(correct: number, total: number = R.questions): number {
  const k = correct * (10 / total);
  return k >= balance.stars.three ? 3 : k >= balance.stars.two ? 2 : k >= balance.stars.one ? 1 : 0;
}

export type Line = { source: string; amount: number };

export type Chest = { kind: 'boss' | 'chapter'; coins: number; xp: number; powerups: Partial<Record<string, number>>; title: string | null };

export type RoundSummary = {
  mode: Mode;
  levelId?: string;
  score: number;
  correct: number;
  total: number;
  stars: number;
  prevStars: number;
  newStars: number;
  failed: boolean;
  heartLost: boolean;
  coins: Line[];
  xp: Line[];
  coinsTotal: number;
  xpTotal: number;
  xpBefore: { level: number; xp: number };
  levelUps: LevelUp[];
  cards: CardEvent[];
  regions: string[];
  missions: MissionTick[];
  streak: StreakEvent;
  streakMilestone: StreakMilestone | null;
  chest: Chest | null;
  bestKey: string;
  best: number;
  isBest: boolean;
  maxCombo: number;
  nearMiss: { kind: 'stars'; need: number; stars: number } | null;
};

export type FinishInput = {
  mode: Mode;
  levelId?: string;
  answers: Answer[];
  day: string;
  now: number;
  bestKey: string;
};

export function finishRound(s0: SaveState, inp: FinishInput): { state: SaveState; summary: RoundSummary } {
  let s: SaveState = { ...s0, stats: { ...s0.stats }, journey: { ...s0.journey, stars: { ...s0.journey.stars } } };
  const rw = balance.rewards;
  const ans = inp.answers;
  const correct = ans.filter((a) => a.correct).length;
  const realCorrect = ans.filter((a) => a.correct && !a.skipped).length;
  const total = ans.length;
  const score = ans.reduce((a, b) => a + b.score, 0);
  let maxCombo = 0;
  for (const a of ans) maxCombo = Math.max(maxCombo, a.combo);
  const coins: Line[] = [];
  const xp: Line[] = [];
  const add = (l: Line[], source: string, amount: number) => {
    const v = Math.round(amount);
    if (v > 0) l.push({ source, amount: v });
  };

  const isJourney = inp.mode === 'journey' || inp.mode === 'first';
  // the very first round is a guaranteed success: it always opens level 2
  const stars = isJourney ? (inp.mode === 'first' ? Math.max(1, starsFor(correct, total)) : starsFor(correct, total)) : 0;
  const prevStars = inp.levelId ? s.journey.stars[inp.levelId] ?? 0 : 0;
  const newStars = Math.max(0, stars - prevStars);
  const failed = isJourney && stars === 0;
  let heartLost = false;
  let chest: Chest | null = null;

  if (isJourney) {
    const replay = prevStars > 0 && newStars === 0;
    const replays = s.replays.day === inp.day ? s.replays.count : 0;
    const coinShare = replay ? rw.replayCoinShare : 1;
    const xpShare = replay && replays >= rw.replayFullXpPerDay ? rw.replayXpShareAfter : 1;
    add(coins, 'answers', realCorrect * rw.correctCoins * coinShare);
    add(xp, 'answers', realCorrect * rw.correctXp * xpShare);
    if (!failed) {
      add(coins, 'finish', rw.finishCoins * coinShare);
      add(xp, 'finish', rw.finishXp * xpShare);
    }
    if (replay) s.replays = { day: inp.day, count: replays + 1 };
    for (let k = prevStars; k < stars; k++) {
      add(coins, `star_${k + 1}`, rw.starFirstCoins[k]);
      add(xp, `star_${k + 1}`, rw.starFirstXp[k]);
    }
    if (inp.levelId && stars > prevStars) s.journey.stars[inp.levelId] = stars;
    if (failed && inp.mode === 'journey') {
      s = loseHeart(s, inp.now);
      heartLost = balance.hearts.enabled;
    }
    const lv = inp.levelId ? LEVEL_BY_ID[inp.levelId] : undefined;
    if (lv?.boss && prevStars === 0 && stars > 0) {
      const ch = CHAPTERS[lv.chapterIndex];
      const title = `chapter_${ch.id}`;
      chest = {
        kind: 'chapter',
        coins: rw.bossChestCoins + rw.chapterChestCoins,
        xp: rw.bossChestXp + rw.chapterChestXp,
        powerups: { fiftyFifty: 1, freeze: 1 },
        title,
      };
      s.journey = { ...s.journey, bossesCleared: [...s.journey.bossesCleared, lv.id], chaptersCompleted: [...s.journey.chaptersCompleted, ch.id] };
      s.powerups = { ...s.powerups, fiftyFifty: s.powerups.fiftyFifty + 1, freeze: s.powerups.freeze + 1 };
      s.cosmetics = { ...s.cosmetics, titles: [...s.cosmetics.titles, title] };
      add(coins, 'chest', chest.coins);
      add(xp, 'chest', chest.xp);
    }
  } else if (inp.mode === 'daily') {
    add(coins, 'daily', rw.dailyChallengeCoins + rw.dailyChallengePerCorrect * correct);
    add(xp, 'daily', rw.dailyChallengeXp);
    add(xp, 'answers', correct * rw.correctXp);
  } else if (inp.mode === 'survival') {
    add(coins, 'answers', softCap(realCorrect, rw.survivalSoftCap) * rw.survivalCoinsPerCorrect);
    add(xp, 'answers', softCap(realCorrect, rw.survivalSoftCap) * rw.survivalXpPerCorrect);
    s.stats.survivalBest = Math.max(s.stats.survivalBest, realCorrect);
  } else {
    add(coins, 'answers', realCorrect * rw.correctCoins * rw.quickPlayCoinShare);
    add(xp, 'answers', realCorrect * rw.correctXp);
    add(coins, 'finish', rw.finishCoins * rw.quickPlayCoinShare);
    add(xp, 'finish', rw.finishXp);
  }

  // Atlas: discovery and mastery
  const cards: CardEvent[] = [];
  const missed = new Set(s.missed);
  for (const a of ans) {
    if (a.correct && !a.skipped) {
      const r = recordCorrect(s, cardKindFor(a.type, a.itemId), a.itemId, inp.day);
      s = r.state;
      if (r.ev.isNew || r.ev.masteryUp) cards.push(r.ev);
      missed.delete(a.itemId);
    } else if (!a.correct) missed.add(a.itemId);
  }
  s.missed = [...missed].slice(-60);
  const newCards = cards.filter((c) => c.isNew).length;
  add(coins, 'cards', newCards * rw.newCardCoins);
  add(xp, 'cards', newCards * rw.newCardXp);
  const regions = newlyCompletedRegions(s);
  if (regions.length) {
    s.regionsCompleted = [...s.regionsCompleted, ...regions];
    add(coins, 'region', regions.length * rw.regionCompleteCoins);
    add(xp, 'region', regions.length * rw.regionCompleteXp);
  }

  // recent ids (avoid repeats next round)
  const rk = inp.bestKey;
  s.recent = { ...s.recent, [rk]: [...(s.recent[rk] ?? []), ...ans.map((a) => a.itemId)].slice(-balance.atlas.recentKeep) };

  // pay coins (except chest/level-up, paid by their own logic), then XP and level-ups
  const coinsTotal = coins.reduce((a, b) => a + b.amount, 0);
  const coinsNoChest = coinsTotal - (chest ? chest.coins : 0);
  s.coins += coinsNoChest + (chest ? chest.coins : 0);
  const xpTotal = xp.reduce((a, b) => a + b.amount, 0);
  const xpBefore = { level: s.level, xp: s.xp };
  const lv = addXp(s, xpTotal);
  s = lv.state;

  // stats, streak, missions
  s.totalRounds += 1;
  s.stats = {
    ...s.stats,
    correct: s.stats.correct + realCorrect,
    answered: s.stats.answered + total,
    perfectRounds: s.stats.perfectRounds + (total >= 10 && correct === total ? 1 : 0),
    bestCombo: Math.max(s.stats.bestCombo, maxCombo),
  };
  const st = onRoundFinished(s, inp.day);
  s = st.state;
  const flagsCorrect = ans.filter((a) => a.correct && a.type !== 'map').length;
  const mp = progressMissions(s, { mode: inp.mode, correct: realCorrect, flagsCorrect, stars, maxCombo, newCards, levelPassed: isJourney && !failed });
  s = mp.state;

  const prevBest = s.best[rk] ?? 0;
  const bestVal = inp.mode === 'survival' ? realCorrect : score;
  const isBest = bestVal > prevBest && bestVal > 0;
  if (isBest) s.best = { ...s.best, [rk]: bestVal };

  let nearMiss: RoundSummary['nearMiss'] = null;
  if (isJourney && stars < 3) {
    const need = [balance.stars.one, balance.stars.two, balance.stars.three][stars] - correct;
    if (need > 0 && need <= 2) nearMiss = { kind: 'stars', need, stars: stars + 1 };
  }

  return {
    state: s,
    summary: {
      mode: inp.mode, levelId: inp.levelId, score, correct, total, stars, prevStars, newStars, failed, heartLost,
      coins, xp, coinsTotal, xpTotal, xpBefore, levelUps: lv.ups, cards, regions, missions: mp.ticks,
      streak: st.ev, streakMilestone: st.milestone, chest, bestKey: rk, best: Math.max(prevBest, bestVal), isBest,
      maxCombo, nearMiss,
    },
  };
}
