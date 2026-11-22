// Question picking: tiers from a mix, leaning toward undiscovered and recently missed items, avoiding recent
// repeats (ported from the studio's quiz._pick), with plausible wrong options (nearby items of the same quiz).
import { TIERS, type QType, type TierMix, type Topic } from '../config/levels';
import { AREA_LEAVE_OUT, areaOf, borderInfo, capitalPool, COUNTRY_BY_ID, itemById, optionLabel, pool, sceneOf } from '../data/gameData';
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

// ---------------------------------------------------------------- which is bigger?
const TIER_ORDER: Tier[] = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];
/** Two places differing by less than this are never compared: area figures differ a little between sources. */
export const MIN_AREA_RATIO = 1.5;
const MAX_AREA_RATIO = 8;

/** Places that can be compared, each with at least one fair partner nearby (so the camera shows both). */
export function biggerPool(topic: Topic): { id: string; tier: Tier }[] {
  const p = pool(topic, false).filter((x) => !AREA_LEAVE_OUT.has(x.id));
  const ids = new Set(p.map((x) => x.id));
  return p.filter((x) => biggerPartners(x.id, ids).length > 0);
}

function biggerPartners(id: string, ids: ReadonlySet<string>): string[] {
  const a = itemById(id);
  return a.near.filter((o) => {
    if (!ids.has(o) || AREA_LEAVE_OUT.has(o)) return false;
    const x = areaOf(a);
    const y = areaOf(itemById(o));
    if (!x || !y) return false;
    const r = Math.max(x, y) / Math.min(x, y);
    return r >= MIN_AREA_RATIO && r <= MAX_AREA_RATIO;
  });
}

export function makeBigger(id: string, poolIds: ReadonlySet<string>, rng: Rng, taken: ReadonlySet<string> = new Set()): Question | null {
  const partners = biggerPartners(id, poolIds).filter((o) => !taken.has(o));
  if (!partners.length) return null;
  const o = rng.pick(partners);
  const a = itemById(id);
  const b = itemById(o);
  const big = areaOf(a) >= areaOf(b) ? a : b;
  const small = big === a ? b : a;
  const ratio = areaOf(big) / areaOf(small);
  // on the Mercator map, far-north places look bigger than they are: when that flips the answer it is a trap
  const trap = small.area_u > big.area_u;
  let t = ratio > 4 ? 0 : ratio > 2.5 ? 1 : ratio > 1.8 ? 2 : 3;
  if (trap) t = Math.min(4, t + 2);
  const options = rng.shuffle([id, o]);
  return { itemId: big.id, scene: sceneOf(id), type: 'bigger', tier: TIER_ORDER[t], options, answer: options.indexOf(big.id), trap };
}

// ---------------------------------------------------------------- which one borders X?
export function bordersPool(topic: Topic): { id: string; tier: Tier }[] {
  return pool(topic, false).filter((x) => {
    const b = borderInfo(x.id);
    return !!b && b.borders.length > 0 && b.far.length >= 3;
  });
}

export function makeBorders(id: string, tier: Tier, rng: Rng): Question | null {
  const info = borderInfo(id);
  if (!info || !info.borders.length || info.far.length < 3) return null;
  const right = rng.pick(info.borders);
  // wrong answers that clearly do not border it, chosen to be tempting: on the same continent, well known, close by
  // (Chile and Ecuador for Brazil, not Caribbean islands). `far` is ordered nearest first.
  const subject = itemById(id);
  const scored = info.far.map((o, i) => {
    const it = itemById(o);
    const known = TIER_ORDER.indexOf(it.tier ?? 'very_hard');
    return { o, k: i * 0.5 + (it.region === subject.region ? 0 : 8) + known * 1.5 + rng.next() * 2 };
  });
  const wrong = scored.sort((a, b) => a.k - b.k).slice(0, 3).map((x) => x.o);
  const options = rng.shuffle([right, ...wrong]);
  return { itemId: right, scene: sceneOf(id), type: 'borders', tier, options, answer: options.indexOf(right), subjectId: id };
}

/** Adds `count` bigger/borders questions to qs, never using a place in `taken` (and adding the ones it uses). */
export function addSpecial(qs: Question[], type: 'bigger' | 'borders', count: number, topic: Topic, mix: TierMix, rng: Rng, prefs: PickPrefs, taken: Set<string>) {
  if (count <= 0) return;
  let added = 0;
  if (type === 'bigger') {
    const ids = new Set(pool(topic, false).map((x) => x.id));
    for (const x of pickItems(biggerPool(topic), count * 3, mix, rng, prefs, taken)) {
      if (added >= count) break;
      if (taken.has(x.id)) continue;
      const q = makeBigger(x.id, ids, rng, taken);
      if (!q) continue;
      q.options.forEach((o) => taken.add(o));
      qs.push(q);
      added++;
    }
    return;
  }
  for (const x of pickItems(bordersPool(topic), count * 2, mix, rng, prefs, taken)) {
    if (added >= count) break;
    const q = makeBorders(x.id, x.tier, rng);
    if (!q || taken.has(q.itemId)) continue;
    taken.add(x.id);
    taken.add(q.itemId);
    qs.push(q);
    added++;
  }
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
  addSpecial(qs, 'bigger', plan.filter((t) => t === 'bigger').length, topic, mix, rng, prefs, taken);
  addSpecial(qs, 'borders', plan.filter((t) => t === 'borders').length, topic, mix, rng, prefs, taken);
  const ftypes = plan.filter((t) => t === 'flag' || t === 'name_to_flag');
  if (ftypes.length > 0) {
    const p = pool(topic === 'usa' ? 'world' : topic, true);
    const ids = new Set(p.map((x) => x.id));
    pickItems(p, ftypes.length, mix, rng, prefs, taken).forEach((x, i) => {
      qs.push(makeQuestion(x.id, x.tier, ftypes[i] ?? 'flag', ids, rng));
    });
  }
  // a small topic can run out of fair pairs or border questions: fill with map questions
  if (qs.length < n) {
    const p = pool(topic, false);
    const ids = new Set(p.map((x) => x.id));
    for (const x of pickItems(p, n - qs.length, mix, rng, prefs, taken)) {
      taken.add(x.id);
      qs.push(makeQuestion(x.id, x.tier, 'map', ids, rng));
    }
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
