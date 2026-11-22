import { balance, XP_TABLE } from '../../config/balance';
import { LEVELS, TIER_MIX } from '../../config/levels';
import { itemById, pool } from '../../data/gameData';
import { cardKey } from '../atlas';
import { claimLogin, dailyQuestions, ensureMissions, progressMissions } from '../daily';
import { interstitialAllowed, noteRoundForAds, buy } from '../economy';
import { chapterLock, currentLevel, heartsNow, isLevelOpen, loseHeart } from '../journey';
import { buildRound, optionsFor, pickItems, tierCounts } from '../picker';
import { addXp, totalXpTo } from '../progression';
import { makeRng } from '../rng';
import { finishRound, scoreFor, starsFor } from '../round';
import { migrate, newSave, type SaveState } from '../save';
import { canRepair, displayedStreak, onRoundFinished, repair } from '../streak';
import { dayKey, daysBetween } from '../time';
import type { Answer } from '../types';

const T0 = Date.UTC(2026, 10, 15, 10, 0, 0); // 15 Nov 2026 10:00 UTC
const DAY = 86400000;

function answers(nRight: number, n = 10, type: 'map' | 'flag' = 'map'): Answer[] {
  const ids = pool('world').slice(0, n).map((x) => x.id);
  return ids.map((id, i) => ({
    itemId: id, type, scene: 'world', tier: 'easy', correct: i < nRight, chosen: 0, timeMs: 2000,
    score: i < nRight ? 150 : 0, combo: i < nRight ? i + 1 : 0,
  }));
}

describe('picker', () => {
  test('tierCounts sums to n and respects zero weights', () => {
    expect(tierCounts(TIER_MIX.mixed, 10).reduce((a, b) => a + b, 0)).toBe(10);
    expect(tierCounts(TIER_MIX.ve, 10)).toEqual([10, 0, 0, 0, 0]);
  });
  test('pickItems returns unique ids, borrowing tiers when short', () => {
    const p = pool('europe');
    const got = pickItems(p, 10, TIER_MIX.ve, makeRng(1));
    expect(got).toHaveLength(10);
    expect(new Set(got.map((g) => g.id)).size).toBe(10);
  });
  test('options: 4 unique names, include the answer, never duplicates', () => {
    const p = pool('world');
    const ids = new Set(p.map((x) => x.id));
    for (const { id } of p) {
      const o = optionsFor(id, 'map', ids, makeRng(id));
      expect(o).toContain(id);
      expect(o).toHaveLength(4);
      expect(new Set(o.map((x) => itemById(x).name.en)).size).toBe(4);
    }
  });
  test('flag options only use countries with flags', () => {
    const p = pool('world', true);
    const ids = new Set(p.map((x) => x.id));
    for (const { id } of p.slice(0, 50)) for (const o of optionsFor(id, 'flag', ids, makeRng(id))) expect(itemById(o).flag).toBe(true);
  });
  test('US state rounds use states only', () => {
    const qs = buildRound('usa', { map: 1 }, TIER_MIX.e, 10, makeRng(3));
    expect(qs).toHaveLength(10);
    for (const q of qs) {
      expect(q.scene).toBe('usa');
      for (const o of q.options) expect(o.startsWith('US-')).toBe(true);
    }
  });
  test('first round starts with the guaranteed question', () => {
    const qs = buildRound('world', { map: 1 }, TIER_MIX.ve, 10, makeRng(9), {}, 'US');
    expect(qs[0].itemId).toBe('US');
  });
  test('recent items are avoided', () => {
    const p = pool('world').filter((x) => x.tier === 'very_easy');
    const recent = new Set(p.slice(0, 16).map((x) => x.id));
    const got = pickItems(p, 10, TIER_MIX.ve, makeRng(5), { recent });
    expect(got.filter((g) => recent.has(g.id)).length).toBeLessThanOrEqual(1);
  });
});

describe('scoring and rewards', () => {
  test('score and stars', () => {
    expect(scoreFor(true, 1, 1)).toBe(150);
    expect(scoreFor(true, 0, 9)).toBe(500);
    expect(scoreFor(false, 1, 3)).toBe(0);
    expect([4, 5, 7, 9].map((c) => starsFor(c))).toEqual([0, 1, 2, 3]);
  });
  test('first clear pays stars once; replays pay a quarter', () => {
    let s = newSave(T0);
    const lv = LEVELS[0].id;
    const r1 = finishRound(s, { mode: 'journey', levelId: lv, answers: answers(9), day: dayKey(T0, 0), now: T0, bestKey: lv });
    expect(r1.summary.stars).toBe(3);
    expect(r1.summary.coins.find((c) => c.source === 'star_3')?.amount).toBe(balance.rewards.starFirstCoins[2]);
    s = r1.state;
    const r2 = finishRound(s, { mode: 'journey', levelId: lv, answers: answers(9), day: dayKey(T0, 0), now: T0, bestKey: lv });
    expect(r2.summary.coins.find((c) => c.source.startsWith('star'))).toBeUndefined();
    expect(r2.summary.coins.find((c) => c.source === 'answers')?.amount).toBe(Math.round(9 * balance.rewards.correctCoins * balance.rewards.replayCoinShare));
  });
  test('failing a level costs a heart and gives no star', () => {
    const s = newSave(T0);
    const r = finishRound(s, { mode: 'journey', levelId: LEVELS[0].id, answers: answers(3), day: dayKey(T0, 0), now: T0, bestKey: 'x' });
    expect(r.summary.failed).toBe(true);
    expect(r.state.hearts.count).toBe(balance.hearts.max - 1);
    expect(r.state.journey.stars[LEVELS[0].id]).toBeUndefined();
  });
  test('first round discovers cards and reaches level 2', () => {
    const s = newSave(T0);
    const r = finishRound(s, { mode: 'first', levelId: LEVELS[0].id, answers: answers(8), day: dayKey(T0, 0), now: T0, bestKey: 'first' });
    expect(r.summary.cards.filter((c) => c.isNew)).toHaveLength(8);
    expect(r.state.level).toBeGreaterThanOrEqual(2);
    expect(r.state.atlas[cardKey('country', answers(1)[0].itemId)]).toBeDefined();
  });
  test('boss first clear opens a chapter chest', () => {
    let s = newSave(T0);
    for (const l of LEVELS.slice(0, 9)) s.journey.stars[l.id] = 2;
    const boss = LEVELS[9];
    expect(isLevelOpen(s, boss)).toBe(true);
    const r = finishRound(s, { mode: 'journey', levelId: boss.id, answers: answers(8), day: dayKey(T0, 0), now: T0, bestKey: boss.id });
    expect(r.summary.chest?.coins).toBe(balance.rewards.bossChestCoins + balance.rewards.chapterChestCoins);
  });
});

describe('xp curve', () => {
  test('table is rounded to 5 and level 2 comes after the first round', () => {
    for (const v of XP_TABLE.slice(1)) expect(v % 5).toBe(0);
    expect(XP_TABLE[1]).toBe(balance.xp.base);
  });
  test('times to level match the design (~3,300 XP/hour)', () => {
    const perHour = 3300;
    const h = (lv: number) => totalXpTo(lv) / perHour;
    expect(h(5) * 60).toBeGreaterThan(4);
    expect(h(5) * 60).toBeLessThan(10);
    expect(h(10) * 60).toBeGreaterThan(18);
    expect(h(10) * 60).toBeLessThan(35);
    expect(h(20)).toBeGreaterThan(1.4);
    expect(h(20)).toBeLessThan(2.8);
    expect(h(50)).toBeGreaterThan(18);
    expect(h(50)).toBeLessThan(28);
  });
  test('level ups pay coins', () => {
    const r = addXp(newSave(T0), balance.xp.base + 5);
    expect(r.ups).toHaveLength(1);
    expect(r.state.coins).toBe(balance.start.coins + balance.rewards.levelUpCoins + (balance.levelRewards[2]?.coins ?? 0));
  });
  test('level rewards: level 6 gives a map theme, level 10 a chest and a title', () => {
    const r = addXp(newSave(T0), totalXpTo(10));
    expect(r.state.level).toBe(10);
    expect(r.state.cosmetics.owned).toContain('mint');
    expect(r.state.cosmetics.owned).toContain('btn_bubble');
    expect(r.state.cosmetics.titles).toContain('level_navigator');
    expect(r.ups.find((u) => u.level === 10)?.reward.chest).toBe(true);
  });
});

describe('streak with a fake clock', () => {
  const day = (n: number) => dayKey(T0 + n * DAY, 0);
  test('7 days in a row: milestones at 3 and 7', () => {
    let s = newSave(T0);
    const coins0 = s.coins;
    for (let d = 0; d < 7; d++) {
      s = onRoundFinished(s, day(d)).state;
      s = onRoundFinished(s, day(d)).state; // second round same day does not count twice
    }
    expect(s.streak.count).toBe(7);
    expect(s.coins - coins0).toBe(100 + 250);
  });
  test('a freeze saves a missed day, and is used up', () => {
    let s = newSave(T0);
    s = onRoundFinished(s, day(0)).state;
    s = { ...s, streak: { ...s.streak, freezes: 1 } };
    const r = onRoundFinished(s, day(2));
    expect(r.ev.kind).toBe('froze');
    expect(r.state.streak.count).toBe(2);
    expect(r.state.streak.freezes).toBe(0);
  });
  test('a break resets to 1 and offers a repair that day', () => {
    let s = newSave(T0);
    for (let d = 0; d < 5; d++) s = onRoundFinished(s, day(d)).state;
    const r = onRoundFinished(s, day(8));
    expect(r.ev).toEqual({ kind: 'broken', lost: 5, count: 1 });
    expect(canRepair(r.state, day(8))).toBe(true);
    expect(repair(r.state).streak.count).toBe(6);
    expect(canRepair(r.state, day(9))).toBe(false);
  });
  test('clock set back never breaks or double counts', () => {
    let s = newSave(T0);
    s = onRoundFinished(s, day(3)).state;
    const r = onRoundFinished(s, day(1));
    expect(r.state.streak.count).toBe(1);
    expect(r.ev.kind).toBe('same_day');
  });
  test('midnight and time-zone change', () => {
    const late = Date.UTC(2026, 10, 15, 23, 59, 0);
    expect(dayKey(late, 0)).toBe('2026-11-15');
    expect(dayKey(late + 2 * 60000, 0)).toBe('2026-11-16');
    // flying east: same instant is already tomorrow in Istanbul (+180)
    expect(dayKey(late, 180)).toBe('2026-11-16');
    let s = newSave(T0);
    s = onRoundFinished(s, dayKey(late, 0)).state;
    s = onRoundFinished(s, dayKey(late + 3600000, 180)).state;
    expect(s.streak.count).toBe(2);
  });
  test('displayed streak is 0 after a real break', () => {
    let s = newSave(T0);
    s = onRoundFinished(s, day(0)).state;
    expect(displayedStreak(s, day(1))).toBe(1);
    expect(displayedStreak(s, day(3))).toBe(0);
  });
});

describe('daily systems', () => {
  test('login calendar: 7 days, chest on day 7, a missed day pauses', () => {
    let s = newSave(T0);
    const got: number[] = [];
    for (let d = 0; d < 9; d++) {
      if (d === 4) continue; // missed day
      const r = claimLogin(s, dayKey(T0 + d * DAY, 0));
      got.push(r.coins);
      s = r.state;
      expect(claimLogin(s, dayKey(T0 + d * DAY, 0)).coins).toBe(0);
    }
    expect(got).toEqual([50, 75, 100, 150, 200, 300, 500, 50]);
  });
  test('Daily Challenge is the same for everyone on a date and differs by date', () => {
    const a = dailyQuestions('2026-11-15');
    const b = dailyQuestions('2026-11-15');
    const c = dailyQuestions('2026-11-16');
    expect(a).toEqual(b);
    expect(a.map((q) => q.itemId)).not.toEqual(c.map((q) => q.itemId));
    expect(a).toHaveLength(10);
    expect(a.filter((q) => q.scene === 'usa')).toHaveLength(2);
  });
  test('missions: three a day, progress from rounds', () => {
    let s = ensureMissions(newSave(T0), '2026-11-15');
    expect(s.missions.list).toHaveLength(3);
    s = { ...s, missions: { ...s.missions, list: [{ id: 'correct_answers', target: 20, progress: 0, claimed: false }] } };
    const r = progressMissions(s, { mode: 'journey', correct: 8, flagsCorrect: 0, stars: 2, maxCombo: 4, newCards: 3, levelPassed: true });
    expect(r.state.missions.list[0].progress).toBe(8);
  });
  test('simulating 7 days of play gives the expected streak and login coins', () => {
    let s = newSave(T0);
    let loginCoins = 0;
    for (let d = 0; d < 7; d++) {
      const day = dayKey(T0 + d * DAY, 0);
      const l = claimLogin(s, day);
      loginCoins += l.coins;
      s = ensureMissions(l.state, day);
      s = finishRound(s, { mode: 'quick', answers: answers(8), day, now: T0 + d * DAY, bestKey: 'q' }).state;
    }
    expect(s.streak.count).toBe(7);
    expect(loginCoins).toBe(50 + 75 + 100 + 150 + 200 + 300 + 500);
    expect(s.streak.milestones).toEqual([3, 7]);
  });
});

describe('journey, hearts, ads, saves', () => {
  test('only level 1 is open at the start; chapter 2 needs the boss and stars', () => {
    const s = newSave(T0);
    expect(currentLevel(s).id).toBe(LEVELS[0].id);
    expect(isLevelOpen(s, LEVELS[1])).toBe(false);
    expect(chapterLock(s, 1).open).toBe(false);
  });
  test('hearts come back every 20 minutes', () => {
    let s = newSave(T0);
    s = loseHeart(loseHeart(s, T0), T0);
    expect(heartsNow(s, T0).count).toBe(3);
    expect(heartsNow(s, T0 + 20 * 60000).count).toBe(4);
    expect(heartsNow(s, T0 + 60 * 60000).count).toBe(5);
    expect(heartsNow(s, T0 - 60000).count).toBe(3);
  });
  test('interstitials: none early, then every 3 rounds and 90 s apart', () => {
    let s: SaveState = newSave(T0);
    expect(interstitialAllowed(s, T0, { firstSession: false, afterRewarded: false })).toBe(false);
    s = { ...s, totalRounds: 5 };
    for (let i = 0; i < 3; i++) s = noteRoundForAds(s);
    expect(interstitialAllowed(s, T0, { firstSession: true, afterRewarded: false })).toBe(false);
    expect(interstitialAllowed(s, T0, { firstSession: false, afterRewarded: true })).toBe(false);
    expect(interstitialAllowed(s, T0, { firstSession: false, afterRewarded: false })).toBe(true);
    s = { ...s, ads: { ...s.ads, lastInterstitialAt: T0 - 30000 } };
    expect(interstitialAllowed(s, T0, { firstSession: false, afterRewarded: false })).toBe(false);
  });
  test('streak freeze: max 2', () => {
    let s = { ...newSave(T0), coins: 5000 };
    s = buy(s, 'streakFreeze', T0).state;
    s = buy(s, 'streakFreeze', T0).state;
    expect(buy(s, 'streakFreeze', T0).ok).toBe(false);
    expect(s.streak.freezes).toBe(2);
  });
  test('saves migrate without losing coins or streak', () => {
    const v1 = { version: 1, coins: 1234, level: 7, xp: 40, streak: { count: 12, lastDay: '2026-11-14' }, survivalBest: 31, hearts: { count: 2 } };
    const s = migrate(v1, T0);
    expect(s.version).toBe(2);
    expect(s.coins).toBe(1234);
    expect(s.streak.count).toBe(12);
    expect(s.streak.freezes).toBe(0);
    expect(s.stats.survivalBest).toBe(31);
    expect(s.hearts.count).toBe(2);
    expect(migrate(null, T0).coins).toBe(balance.start.coins);
    expect(daysBetween('2026-11-14', '2026-11-16')).toBe(2);
  });
});

describe('capital questions', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { capitalOf } = require('../../data/capitals');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildRound: build } = require('../picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { makeRng: rngOf } = require('../rng');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dailyQuestions: daily } = require('../daily');

  test('every option of a capital question has a capital, all four different', () => {
    for (const topic of ['world', 'europe', 'usa', 'africa', 'oceania']) {
      const qs = build(topic, { capital: 1 }, [0.2, 0.2, 0.2, 0.2, 0.2], 10, rngOf(`cap-${topic}`));
      expect(qs).toHaveLength(10);
      for (const q of qs) {
        expect(q.type).toBe('capital');
        const caps = q.options.map((o: string) => capitalOf(o));
        expect(caps.every(Boolean)).toBe(true);
        expect(new Set(caps).size).toBe(q.options.length);
        expect(q.options[q.answer]).toBe(q.itemId);
      }
    }
  });

  test('disputed or split capitals are never asked', () => {
    const qs = build('world', { capital: 1 }, [0.2, 0.2, 0.2, 0.2, 0.2], 200, rngOf('cap-all'));
    // (200 is more than there are capitals: the rest of the round is filled with map questions, which may be anywhere)
    for (const q of qs.filter((x: { type: string }) => x.type === 'capital')) for (const o of q.options) expect(['BO', 'ZA', 'IL', 'LK', 'SZ', 'NR']).not.toContain(o);
  });

  test('a mixed round never asks the same place twice', () => {
    const qs = build('europe', { map: 0.5, capital: 0.5 }, [0.2, 0.2, 0.2, 0.2, 0.2], 10, rngOf('mix'));
    expect(new Set(qs.map((q: { itemId: string }) => q.itemId)).size).toBe(10);
  });

  test('the Daily Challenge has one capital question and no repeats', () => {
    const qs = daily('2026-11-22');
    expect(qs.filter((q: { type: string }) => q.type === 'capital')).toHaveLength(1);
    expect(new Set(qs.map((q: { itemId: string }) => q.itemId)).size).toBe(qs.length);
  });
});

describe('bigger and borders questions', () => {
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { buildRound: build, MIN_AREA_RATIO } = require('../picker');
  const { makeRng: rngOf } = require('../rng');
  const { borderInfo, areaOf, itemById } = require('../../data/gameData');
  const { dailyQuestions: daily } = require('../daily');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const mix = [0.2, 0.2, 0.2, 0.2, 0.2];

  test('bigger: two places, the answer is the bigger one by a clear margin', () => {
    for (const topic of ['world', 'europe', 'usa', 'americas']) {
      for (const q of build(topic, { bigger: 1 }, mix, 10, rngOf(`big-${topic}`)).filter((x: { type: string }) => x.type === 'bigger')) {
        expect(q.options).toHaveLength(2);
        const [a, b] = q.options.map((o: string) => areaOf(itemById(o)));
        const big = Math.max(a, b);
        expect(areaOf(itemById(q.options[q.answer]))).toBe(big);
        expect(q.options[q.answer]).toBe(q.itemId);
        expect(big / Math.min(a, b)).toBeGreaterThanOrEqual(MIN_AREA_RATIO);
      }
    }
  });

  test('borders: exactly one option borders the subject, and the others are clearly apart', () => {
    for (const topic of ['world', 'africa', 'usa', 'europe']) {
      const qs = build(topic, { borders: 1 }, mix, 10, rngOf(`bor-${topic}`)).filter((x: { type: string }) => x.type === 'borders');
      expect(qs.length).toBeGreaterThan(5);
      for (const q of qs) {
        const info = borderInfo(q.subjectId);
        expect(q.options).toHaveLength(4);
        expect(q.options.filter((o: string) => info.borders.includes(o))).toEqual([q.itemId]);
        for (const o of q.options) if (o !== q.itemId) expect(info.far).toContain(o);
      }
    }
  });

  test('arguable borders are never asked', () => {
    const bad = [['DJ', 'SO'], ['AL', 'RS'], ['IN', 'AF'], ['SG', 'MY'], ['US-MI', 'US-IL']];
    for (const [x, y] of bad) {
      for (const [s, o] of [[x, y], [y, x]]) {
        const info = borderInfo(s);
        if (!info) continue;
        expect(info.borders).not.toContain(o);
        expect(info.far).not.toContain(o);
      }
    }
  });

  test('the Daily Challenge has one size question and no place twice', () => {
    const qs = daily('2026-11-23');
    expect(qs.filter((q: { type: string }) => q.type === 'bigger')).toHaveLength(1);
    const used = qs.flatMap((q: { type: string; options: string[]; itemId: string }) => (q.type === 'bigger' ? q.options : [q.itemId]));
    expect(new Set(used).size).toBe(used.length);
  });
});
