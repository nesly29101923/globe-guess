// Turns a route (mode + params) into a QuizDef. Pure apart from reading the save it is given.
import { balance } from '../config/balance';
import { FIRST_ROUND, LEVEL_BY_ID, QUICK_TOPICS, TIER_MIX, type QType, type TierMix, type Topic } from '../config/levels';
import { capitalPool, pool } from '../data/gameData';
import { cardKey } from '../logic/atlas';
import { dailyQuestions } from '../logic/daily';
import { buildRound, makeQuestion, pickItems, type PickPrefs } from '../logic/picker';
import { makeRng } from '../logic/rng';
import type { SaveState } from '../logic/save';
import type { Question, QuizDef, Tier } from '../logic/types';

export type PlayParams = { mode: string; level?: string; quick?: string; tier?: string; nonce?: string };

function prefsFor(s: SaveState, key: string, topic: Topic, flags: boolean): PickPrefs {
  const kind = topic === 'usa' ? 'state' : flags ? 'flag' : 'country';
  const ids = pool(topic, flags).map((x) => x.id);
  return {
    recent: new Set(s.recent[key] ?? []),
    undiscovered: new Set(ids.filter((id) => !s.atlas[cardKey(kind, id)])),
    missed: new Set(s.missed),
  };
}

const TIER_TO_MIX: Record<string, TierMix> = {
  very_easy: TIER_MIX.ve, easy: TIER_MIX.e, medium: TIER_MIX.m, hard: TIER_MIX.h, very_hard: TIER_MIX.vh, mixed: TIER_MIX.mixed,
};

export function bestKeyFor(p: PlayParams): string {
  if (p.mode === 'journey' || p.mode === 'first') return `level:${p.level ?? 'world_famous-1'}`;
  if (p.mode === 'quick') return `quick:${p.quick}:${p.tier}`;
  if (p.mode === 'daily') return 'daily';
  return 'survival';
}

export function makeQuiz(p: PlayParams, s: SaveState, day: string, now: number): QuizDef {
  const seed = `${p.mode}:${p.level ?? p.quick ?? ''}:${now}`;
  const rng = makeRng(seed);
  const n = balance.round.questions;
  const key = bestKeyFor(p);
  if (p.mode === 'first') {
    const qs = buildRound(FIRST_ROUND.topic, FIRST_ROUND.types, FIRST_ROUND.mix, n, rng, {}, rng.pick(FIRST_ROUND.firstIds));
    return { mode: 'first', levelId: 'world_famous-1', topicLabel: 'world', tierLabel: 'very_easy', timer: balance.round.firstRoundTimerSeconds, questions: qs, seed };
  }
  if (p.mode === 'journey') {
    const lv = LEVEL_BY_ID[p.level ?? 'world_famous-1'];
    const flagShare = (lv.types.flag ?? 0) + (lv.types.name_to_flag ?? 0);
    const qs = buildRound(lv.topic, lv.types, lv.mix, n, rng, prefsFor(s, key, lv.topic, flagShare >= 0.99));
    const main = Object.entries(lv.types).sort((a, b) => b[1] - a[1])[0][0];
    const tierIdx = lv.mix.findIndex((w) => w === Math.max(...lv.mix));
    return {
      mode: 'journey', levelId: lv.id, topicLabel: main === 'map' ? lv.topic : main === 'capital' ? 'capitals' : 'flags',
      tierLabel: lv.boss ? 'boss' : (['very_easy', 'easy', 'medium', 'hard', 'very_hard'][tierIdx] as string),
      timer: lv.boss ? balance.round.bossTimerSeconds : balance.round.timerSeconds, questions: qs, seed,
    };
  }
  if (p.mode === 'daily') {
    return { mode: 'daily', topicLabel: 'daily', tierLabel: 'mixed', timer: balance.round.timerSeconds, questions: dailyQuestions(day), seed: `daily:${day}` };
  }
  if (p.mode === 'quick') {
    const q = QUICK_TOPICS.find((x) => x.id === p.quick) ?? QUICK_TOPICS[0];
    const tier = p.tier ?? 'mixed';
    const qs = buildRound(q.topic, { [q.type]: 1 }, TIER_TO_MIX[tier] ?? TIER_MIX.mixed, n, rng, prefsFor(s, key, q.topic, q.type === 'flag' || q.type === 'name_to_flag'));
    return { mode: 'quick', topicLabel: q.type === 'map' ? q.topic : q.type === 'capital' ? 'capitals' : 'flags', tierLabel: tier, timer: balance.round.timerSeconds, questions: qs, seed };
  }
  // survival: the first batch; more questions are appended as the run goes on
  return { mode: 'survival', topicLabel: 'survival', tierLabel: 'very_easy', timer: balance.round.survivalTimerSeconds, questions: survivalBatch(0, new Set(), rng), seed };
}

const S_TIERS: Tier[] = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];

/** Survival: 5 questions at the tier for the current number of right answers (climbs every 5). */
export function survivalBatch(correctSoFar: number, used: Set<string>, rng = makeRng(Date.now())): Question[] {
  const ti = Math.min(4, Math.floor(correctSoFar / balance.survival.tierStepEvery));
  const tier = S_TIERS[ti];
  const out: Question[] = [];
  for (let i = 0; i < 5; i++) {
    const r = rng.next();
    const type: QType = r < 0.6 ? 'map' : r < 0.85 ? 'flag' : 'capital';
    const p = type === 'capital' ? capitalPool('world').map((x) => ({ ...x, tier: x.tier })) : pool('world', type !== 'map');
    const ids = new Set(p.map((x) => x.id));
    const mix: TierMix = [0, 0, 0, 0, 0];
    mix[ti] = 1;
    const [x] = pickItems(p, 1, mix, rng, { recent: used });
    if (!x) continue;
    used.add(x.id);
    out.push(makeQuestion(x.id, x.tier ?? tier, type, ids, rng));
  }
  return out;
}
