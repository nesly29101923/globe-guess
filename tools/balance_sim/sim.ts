// Balance simulation. Reads the same config and runs the same reward logic as the game.
//   npm run sim            -> prints the report and writes tools/balance_sim/REPORT.md
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { balance } from '../../src/config/balance';
import { COSMETICS, PRODUCTS } from '../../src/config/cosmetics';
import { CHAPTERS, LEVELS, TIER_MIX } from '../../src/config/levels';
import { claimLogin, claimMission, claimMissionChest, dailyQuestions, ensureMissions } from '../../src/logic/daily';
import { buy, spendPowerup } from '../../src/logic/economy';
import { currentLevel, heartsNow, isLevelOpen, syncHearts } from '../../src/logic/journey';
import { buildRound } from '../../src/logic/picker';
import { totalXpTo } from '../../src/logic/progression';
import { makeRng, type Rng } from '../../src/logic/rng';
import { finishRound } from '../../src/logic/round';
import { newSave, type SaveState } from '../../src/logic/save';
import { dayKey } from '../../src/logic/time';
import type { Answer, Question, Tier } from '../../src/logic/types';

type Profile = { name: string; acc: Record<Tier, number>; roundsPerDay: number; usesPowerups: number; buysFreezes: boolean };

const PROFILES: Profile[] = [
  { name: 'casual', acc: { very_easy: 0.9, easy: 0.75, medium: 0.55, hard: 0.4, very_hard: 0.3 }, roundsPerDay: 5, usesPowerups: 0.5, buysFreezes: true },
  { name: 'average', acc: { very_easy: 0.95, easy: 0.87, medium: 0.72, hard: 0.58, very_hard: 0.45 }, roundsPerDay: 8, usesPowerups: 0.5, buysFreezes: true },
  { name: 'skilled', acc: { very_easy: 0.99, easy: 0.96, medium: 0.9, hard: 0.8, very_hard: 0.65 }, roundsPerDay: 12, usesPowerups: 0.3, buysFreezes: true },
];
const ROUND_MIN = 2;   // minutes per round including the result screen
const T0 = Date.UTC(2026, 10, 15, 8, 0, 0);

function answer(qs: Question[], p: Profile, rng: Rng, boost = 0): Answer[] {
  let combo = 0;
  return qs.map((q) => {
    const ok = rng.next() < Math.min(0.995, p.acc[q.tier] + boost);
    combo = ok ? combo + 1 : 0;
    return { itemId: q.itemId, type: q.type, scene: q.scene, tier: q.tier, correct: ok, chosen: ok ? q.answer : (q.answer + 1) % 4,
      timeMs: 4000, score: ok ? 100 * Math.min(5, combo) + 25 : 0, combo };
  });
}

type Run = {
  minutes: number; coinsEarned: number; xpEarned: number; levelAt: Record<number, number>; chapterAt: Record<string, number>;
  coinsByDay: Record<number, number>; cosmeticDay: Record<string, number>; spentPowerups: number; streak: number; journeyDone: boolean;
  farm: Record<string, number>;
};

function simulate(p: Profile, days: number, opts: { ads: boolean } = { ads: false }): Run {
  const rng = makeRng(`sim:${p.name}`);
  let s: SaveState = newSave(T0);
  const run: Run = { minutes: 0, coinsEarned: 0, xpEarned: 0, levelAt: {}, chapterAt: {}, coinsByDay: {}, cosmeticDay: {}, spentPowerups: 0, streak: 0, journeyDone: false, farm: {} };
  // the first map theme is the first goal (it changes the whole look), then cheapest first
  const priced = COSMETICS.filter((c) => c.price && c.price > 0).sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const firstMap = priced.find((c) => c.kind === 'map')!;
  const wishlist = [firstMap, ...priced.filter((c) => c !== firstMap)];
  for (let d = 0; d < days; d++) {
    const now0 = T0 + d * 86400000;
    const day = dayKey(now0, 0);
    let now = now0;
    // daily: login, missions, daily challenge
    const before = s.coins;
    s = claimLogin(s, day).state;
    s = ensureMissions(s, day);
    const play = (mode: 'journey' | 'daily' | 'first', levelId?: string) => {
      let qs: Question[];
      if (mode === 'daily') qs = dailyQuestions(day);
      else {
        const lv = LEVELS.find((l) => l.id === levelId)!;
        qs = buildRound(lv.topic, lv.types, lv.mix, 10, rng);
      }
      const usePu = rng.next() < p.usesPowerups && mode === 'journey';
      if (usePu) {
        const pu = (['fiftyFifty', 'freeze', 'skip'] as const)[rng.int(3)];
        let st = spendPowerup(s, pu);
        if (!st) {
          const r = buy(s, pu, now);
          if (r.ok) {
            run.spentPowerups += balance.prices[pu];
            st = spendPowerup(r.state, pu);
          }
        }
        if (st) s = st;
      }
      const ans = answer(qs, p, rng, usePu ? 0.06 : 0);
      const xp0 = s.xp;
      const lv0 = s.level;
      const c0 = s.coins;
      const r = finishRound(s, { mode, levelId, answers: ans, day, now, bestKey: levelId ?? mode });
      s = r.state;
      run.coinsEarned += Math.max(0, s.coins - c0);
      run.xpEarned += r.summary.xpTotal;
      void xp0;
      void lv0;
      run.minutes += ROUND_MIN;
      now += ROUND_MIN * 60000;
      for (let L = 2; L <= s.level; L++) if (run.levelAt[L] == null) run.levelAt[L] = run.minutes;
      for (const ch of s.journey.chaptersCompleted) if (run.chapterAt[ch] == null) run.chapterAt[ch] = run.minutes;
      return r.summary;
    };
    if (d === 0) play('first', 'world_famous-1');
    if (s.level >= balance.unlocks.dailyChallenge) play('daily');
    for (let i = 0; i < p.roundsPerDay; i++) {
      s = syncHearts(s, now);
      const lv = currentLevel(s);
      if (heartsNow(s, now).count <= 0) {
        // out of hearts: wait (other modes would be played here); time passes
        now += balance.hearts.refillMinutes * 60000;
        continue;
      }
      if (!isLevelOpen(s, lv)) break;
      if (s.journey.stars[lv.id] && lv.globalIndex === LEVELS.length - 1) {
        run.journeyDone = true;
        // replay farming check
        play('journey', LEVELS[0].id);
        continue;
      }
      // when a chapter is locked by stars, replay the weakest level of the previous chapter
      play('journey', lv.id);
    }
    for (const m of s.missions.list) if (m.progress >= m.target) s = claimMission(s, m.id).state;
    s = claimMissionChest(s).state;
    if (p.buysFreezes && s.streak.freezes < 1 && s.coins > 1500) s = buy(s, 'streakFreeze', now).state;
    // buy cosmetics cheapest first, keeping a small reserve for power-ups
    for (const c of wishlist) {
      if (run.cosmeticDay[c.id] != null) continue;
      if (s.coins - 300 < (c.price ?? 0)) break;   // save up for the next one in order
      {
        s = { ...s, coins: s.coins - (c.price ?? 0) };
        run.cosmeticDay[c.id] = d + 1;
      }
    }
    run.coinsByDay[d + 1] = s.coins;
    void before;
    run.streak = s.streak.count;
  }
  return run;
}

/** Coins per minute of each source, to check that nothing beats normal Journey progress. */
function farming(p: Profile) {
  const rng = makeRng('farm');
  const out: Record<string, number> = {};
  const T = T0;
  // Journey progress: first clears of the first 20 levels
  let s = newSave(T);
  let c0 = s.coins;
  let n = 0;
  for (const lv of LEVELS.slice(0, 20)) {
    for (let k = 0; k < 2; k++) {
      s = { ...s, hearts: { count: 5, since: T } };
      const r = finishRound(s, { mode: 'journey', levelId: lv.id, answers: answer(buildRound(lv.topic, lv.types, lv.mix, 10, rng), p, rng), day: '2026-11-15', now: T, bestKey: lv.id });
      s = r.state;
      n++;
      if (r.summary.stars) break;
    }
  }
  out.journey_progress = (s.coins - c0) / (n * ROUND_MIN);
  // replaying an easy cleared level forever
  c0 = s.coins;
  for (let i = 0; i < 30; i++) s = finishRound(s, { mode: 'journey', levelId: LEVELS[0].id, answers: answer(buildRound('world', { map: 1 }, TIER_MIX.ve, 10, rng), p, rng), day: '2026-11-16', now: T, bestKey: 'x' }).state;
  out.journey_replay = (s.coins - c0) / (30 * ROUND_MIN);
  // quick play
  c0 = s.coins;
  for (let i = 0; i < 30; i++) s = finishRound(s, { mode: 'quick', answers: answer(buildRound('world', { map: 1 }, TIER_MIX.ve, 10, rng), p, rng), day: '2026-11-16', now: T, bestKey: 'q' }).state;
  out.quick_play_very_easy = (s.coins - c0) / (30 * ROUND_MIN);
  // survival: a long run of 60 right (about 6 minutes)
  c0 = s.coins;
  const ans: Answer[] = Array.from({ length: 63 }, (_, i) => ({ itemId: 'FR', type: 'map', scene: 'world', tier: 'medium', correct: i < 60, chosen: 0, timeMs: 3000, score: 100, combo: 1 }));
  s = finishRound(s, { mode: 'survival', answers: ans, day: '2026-11-16', now: T, bestKey: 's' }).state;
  out.survival_60 = (s.coins - c0) / 6.5;
  return out;
}

function fmtMin(m: number | undefined): string {
  if (m == null) return 'not reached';
  return m < 60 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`;
}

const lines: string[] = [];
const say = (x = '') => {
  lines.push(x);
  console.log(x);
};

say('# Balance report');
say();
say(`Generated by tools/balance_sim from src/config/balance.ts and the game's reward logic. Anchor: 1 hour = ${balance.anchorCoinsPerHour} coins.`);
say();
say('## XP curve (target: L2 after the first round, L5 ~7 min, L10 ~25 min, L20 ~2 h, L30 ~5.5 h, L50 ~23 h at ~3,300 XP/h)');
say();
say('| Level | XP from level 1 | at 3,300 XP/h |');
say('|---|---|---|');
for (const L of [2, 5, 10, 20, 30, 50]) say(`| ${L} | ${totalXpTo(L).toLocaleString('en-US')} | ${fmtMin((totalXpTo(L) / 3300) * 60)} |`);
say();

const checks: string[] = [];
for (const p of PROFILES) {
  const r = simulate(p, 30);
  const hours = r.minutes / 60;
  say(`## ${p.name} player (${p.roundsPerDay} rounds a day + Daily Challenge, ${Math.round(p.usesPowerups * 100)}% of rounds use a power-up)`);
  say();
  say(`- Coins per hour of play (all sources incl. daily systems): **${Math.round(r.coinsEarned / hours)}**; XP per hour: **${Math.round(r.xpEarned / hours)}**`);
  say(`- Player level reached: ${Object.keys(r.levelAt).length + 1}; time to L5 ${fmtMin(r.levelAt[5])}, L10 ${fmtMin(r.levelAt[10])}, L20 ${fmtMin(r.levelAt[20])}, L30 ${fmtMin(r.levelAt[30])}`);
  say(`- Chapters finished in 30 days: ${Object.keys(r.chapterAt).length}/${CHAPTERS.length} (${CHAPTERS.filter((c) => r.chapterAt[c.id] != null).map((c) => `${c.id} @ ${fmtMin(r.chapterAt[c.id])}`).join(', ') || 'none'})`);
  say(`- Coins held: day 1 ${r.coinsByDay[1]}, day 7 ${r.coinsByDay[7]}, day 30 ${r.coinsByDay[30]}; spent on power-ups: ${r.spentPowerups}`);
  say(`- Day each cosmetic is bought (first map theme, then cheapest; 300 kept for power-ups): ${Object.entries(r.cosmeticDay).map(([k, v]) => `${k} d${v}`).join(', ') || 'none'}`);
  say(`- Streak after 30 days: ${r.streak}`);
  say();
  if (p.name === 'average') {
    const firstMap = Math.min(...COSMETICS.filter((c) => c.kind === 'map' && c.price).map((c) => r.cosmeticDay[c.id] ?? 99));
    checks.push(`${firstMap >= 2 && firstMap <= 3 ? 'PASS' : 'FAIL'}: a daily player affords the first map theme on day ${firstMap} (target 2-3)`);
    const unaffordable = COSMETICS.filter((c) => c.price && r.cosmeticDay[c.id] == null).length;
    checks.push(`${unaffordable > 0 || (r.coinsByDay[30] ?? 0) < 6000 ? 'PASS' : 'FAIL'}: still something to save for at day 30 (${unaffordable} cosmetics not yet affordable, ${r.coinsByDay[30]} coins held)`);
    checks.push(`${r.spentPowerups > 0 && r.coinsByDay[30] > 0 ? 'PASS' : 'FAIL'}: power-ups at one per two rounds are affordable from play (${r.spentPowerups} coins spent on them in 30 days) but not free`);
    checks.push(`${r.streak >= 30 ? 'PASS' : 'FAIL'}: a player who never watches ads or pays keeps a 30-day streak (${r.streak})`);
  }
  if (p.name === 'casual') {
    checks.push(`${Object.keys(r.chapterAt).length >= 3 ? 'PASS' : 'FAIL'}: a casual no-ads, no-pay player keeps progressing through the Journey (${Object.keys(r.chapterAt).length} chapters in 30 days at 5 rounds a day)`);
  }
}

const f = farming(PROFILES[1]);
say('## Coins per minute by source (average player)');
say();
for (const [k, v] of Object.entries(f)) say(`- ${k}: ${v.toFixed(1)}`);
say();
const best = Math.max(f.journey_replay, f.quick_play_very_easy, f.survival_60);
checks.push(`${best <= f.journey_progress ? 'PASS' : 'FAIL'}: no source pays more per minute than Journey progress (${f.journey_progress.toFixed(1)}/min vs best other ${best.toFixed(1)}/min)`);

// long-run: can the whole Journey be finished without ads or money?
const marathon = simulate(PROFILES[1], 120);
checks.push(`${marathon.journeyDone || Object.keys(marathon.chapterAt).length === CHAPTERS.length ? 'PASS' : 'FAIL'}: an average player finishes the Journey without ads or purchases (${Object.keys(marathon.chapterAt).length}/${CHAPTERS.length} chapters in 120 days)`);

say('## Store packs');
say();
for (const p of PRODUCTS.filter((x) => x.coins)) say(`- ${p.id}: ${p.coins} coins for $${p.usd} = ${Math.round((p.coins ?? 0) / p.usd)} coins per dollar = ${((p.coins ?? 0) / balance.anchorCoinsPerHour).toFixed(1)} h of play`);
say();
say('## Checks');
say();
for (const c of checks) say(`- ${c}`);
writeFileSync(join(__dirname, 'REPORT.md'), lines.join('\n') + '\n');
