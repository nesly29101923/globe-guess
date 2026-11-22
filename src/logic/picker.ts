// Question picking: tiers from a mix, leaning toward undiscovered and recently missed items, avoiding recent
// repeats (ported from the studio's quiz._pick), with plausible wrong options (nearby items of the same quiz).
import { TIERS, type QType, type TierMix, type Topic } from '../config/levels';
import { capitalPool, COUNTRY_BY_ID, itemById, optionLabel, pool, sceneOf } from '../data/gameData';
import { capitalOf } from '../data/capitals';
import type { Rng } from './rng';
import type { Question, QuestionType, Tier } from './types';
import { balance } from '../config/balance';

export type PickPrefs = {
  recent?: ReadonlySet<string>;        // asked lately: avoid
  undiscovered?: ReadonlySet<string>;  // not in the Atlas yet: prefer
  missed?: ReadonlySet<string>;        // missed lately: give a second chance
};

/** Split n questions over the tiers of a mix (largest remainder). */
export function tierCounts(mix: TierMix, n: number): number[] {
  const total = mix.reduce((a, b) => a + b, 0) || 1;
  const raw = mix.map((w) => (w / total) * n);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    if (mix[i] > 0) {
      out[i]++;
      left--;
    }
  }
  return out;
}

function weight(id: string, prefs: PickPrefs): number {
  let w = 1;
  if (prefs.undiscovered?.has(id)) w *= 1 + balance.atlas.preferUndiscovered * 2;
  if (prefs.missed?.has(id)) w *= balance.atlas.recentMissBoost;
  return w;
}

function weightedTake(ids: string[], k: number, prefs: PickPrefs, rng: Rng): string[] {
  // fresh items first; recent ones only when nothing fresh is left
  const fresh = ids.filter((id) => !prefs.recent?.has(id));
  const stale = ids.filter((id) => prefs.recent?.has(id));
  const a = weightedTakeFrom(fresh, k, prefs, rng);
  return a.length >= k ? a : a.concat(weightedTakeFrom(stale, k - a.length, prefs, rng));
}

function weightedTakeFrom(ids: string[], k: number, prefs: PickPrefs, rng: Rng): string[] {
  const left = ids.slice();
  const out: string[] = [];
  while (out.length < k && left.length) {
    const ws = left.map((id) => weight(id, prefs));
    let r = rng.next() * ws.reduce((a, b) => a + b, 0);
    let j = 0;
    for (; j < left.length - 1; j++) {
      r -= ws[j];
      if (r <= 0) break;
    }
    out.push(left[j]);
    left.splice(j, 1);
  }
  return out;
}

/** Pick n ids from a pool for a tier mix. Short tiers borrow from the nearest tiers. */
export function pickItems(
  items: { id: string; tier: Tier }[],
  n: number,
  mix: TierMix,
  rng: Rng,
  prefs: PickPrefs = {},
  exclude: ReadonlySet<string> = new Set(),
): { id: string; tier: Tier }[] {
  const by: Record<string, string[]> = {};
  for (const t of TIERS) by[t] = items.filter((i) => i.tier === t && !exclude.has(i.id)).map((i) => i.id);
  const counts = tierCounts(mix, n);
  const used = new Set<string>();
  const out: { id: string; tier: Tier }[] = [];
  TIERS.forEach((t, ti) => {
    let need = counts[ti];
    const order = [ti, ti + 1, ti - 1, ti + 2, ti - 2, ti + 3, ti - 3, ti + 4, ti - 4].filter((x) => x >= 0 && x < 5);
    for (const oi of order) {
      if (need <= 0) break;
      const avail = by[TIERS[oi]].filter((id) => !used.has(id));
      for (const id of weightedTake(avail, need, prefs, rng)) {
        used.add(id);
        out.push({ id, tier: TIERS[oi] });
        need--;
      }
    }
  });
  return out;
}

/** Wrong options: nearby items of the same quiz, never two with the same name. */
export function optionsFor(id: string, type: QuestionType, poolIds: ReadonlySet<string>, rng: Rng, count = 4): string[] {
  const item = itemById(id);
  const needFlag = type === 'flag' || type === 'name_to_flag';
  const ok = (x: string) => x !== id && (!needFlag || !!COUNTRY_BY_ID[x]?.flag) && (type !== 'capital' || !!capitalOf(x));
  let near = item.near.filter((x) => poolIds.has(x) && ok(x));
  if (near.length < count + 2) near = near.concat(item.near.filter((x) => ok(x) && !near.includes(x)));
  if (near.length < count - 1) {
    const rest = [...poolIds].filter((x) => ok(x) && !near.includes(x));
    near = near.concat(rng.shuffle(rest));
  }
  const candidates = near.slice(0, Math.max(6, count + 2));
  const names = new Set([optionLabel(id, type)]);
  const wrong: string[] = [];
  for (const x of rng.shuffle(candidates.slice())) {
    const nm = optionLabel(x, type);
    if (names.has(nm)) continue;
    names.add(nm);
    wrong.push(x);
    if (wrong.length >= count - 1) break;
  }
  return rng.shuffle([id, ...wrong]);
}

export function makeQuestion(id: string, tier: Tier, type: QuestionType, poolIds: ReadonlySet<string>, rng: Rng): Question {
  const options = optionsFor(id, type, poolIds, rng);
  return { itemId: id, scene: sceneOf(id), type, tier, options, answer: options.indexOf(id) };
}

function chooseType(types: Partial<Record<QType, number>>, rng: Rng): QType {
  const entries = Object.entries(types) as [QType, number][];
  let r = rng.next() * entries.reduce((a, [, w]) => a + w, 0);
  for (const [t, w] of entries) {
    r -= w;
    if (r <= 0) return t;
  }
  return entries[0][0];
}

/** A round of n questions for a topic, type mix and tier mix; ordered easy to hard. */
export function buildRound(
  topic: Topic,
  types: Partial<Record<QType, number>>,
  mix: TierMix,
  n: number,
  rng: Rng,
  prefs: PickPrefs = {},
  firstId?: string,
): Question[] {
  const plan: QType[] = Array.from({ length: n }, () => chooseType(types, rng));
  const qs: Question[] = [];
  const taken = new Set<string>();
  // map questions first (the first-round pick is a map question), then capitals, then flags; no place twice
  const mapCount = plan.filter((t) => t === 'map').length;
  if (mapCount > 0) {
    const p = pool(topic, false);
    const ids = new Set(p.map((x) => x.id));
    let picked = pickItems(p, mapCount, mix, rng, prefs);
    if (firstId && ids.has(firstId) && !picked.some((x) => x.id === firstId)) {
      const t = p.find((x) => x.id === firstId)!.tier;
      picked = [{ id: firstId, tier: t }, ...picked.slice(0, mapCount - 1)];
    }
    for (const x of picked) {
      taken.add(x.id);
      qs.push(makeQuestion(x.id, x.tier, 'map', ids, rng));
    }
  }
  const capCount = plan.filter((t) => t === 'capital').length;
  if (capCount > 0) {
    const p = capitalPool(topic);
    const ids = new Set(p.map((x) => x.id));
    for (const x of pickItems(p, capCount, mix, rng, prefs, taken)) {
      taken.add(x.id);
      qs.push(makeQuestion(x.id, x.tier, 'capital', ids, rng));
    }
  }
  const ftypes = plan.filter((t) => t === 'flag' || t === 'name_to_flag');
  if (ftypes.length > 0) {
    const p = pool(topic === 'usa' ? 'world' : topic, true);
    const ids = new Set(p.map((x) => x.id));
    pickItems(p, ftypes.length, mix, rng, prefs, taken).forEach((x, i) => {
      qs.push(makeQuestion(x.id, x.tier, ftypes[i] ?? 'flag', ids, rng));
    });
  }
  const rank = (t: Tier) => TIERS.indexOf(t);
  const keyed = qs.map((q) => ({ q, k: rank(q.tier) + rng.next() * 0.5 }));
  const sorted = keyed.sort((a, b) => a.k - b.k).map((x) => x.q);
  if (firstId) {
    const k = sorted.findIndex((q) => q.itemId === firstId);
    if (k > 0) sorted.unshift(sorted.splice(k, 1)[0]);
  }
  return sorted;
}
