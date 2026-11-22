import { balance } from '../config/balance';
import { ATLAS_REGIONS, pool } from '../data/gameData';
import type { SaveState } from './save';
import type { CardKind, QuestionType } from './types';

export type Mastery = 0 | 1 | 2 | 3;   // none, bronze, silver, gold

export function cardKey(kind: CardKind, id: string): string {
  return `${kind}:${id}`;
}

export function cardKindFor(type: QuestionType, id: string): CardKind {
  if (id.startsWith('US-')) return 'state';
  return type === 'map' || type === 'capital' ? 'country' : 'flag';
}

export function masteryOf(days: number): Mastery {
  const [b, s, g] = balance.atlas.masteryDays;
  return days >= g ? 3 : days >= s ? 2 : days >= b ? 1 : 0;
}

export type CardEvent = { key: string; id: string; kind: CardKind; isNew: boolean; masteryUp: Mastery | null };

/** Record a right answer. Returns the updated atlas entry and what happened. */
export function recordCorrect(s: SaveState, kind: CardKind, id: string, day: string): { state: SaveState; ev: CardEvent } {
  const key = cardKey(kind, id);
  const prev = s.atlas[key];
  const days = prev ? prev.days : [];
  const before = masteryOf(days.length);
  if (days.includes(day)) return { state: s, ev: { key, id, kind, isNew: false, masteryUp: null } };
  const nextDays = [...days, day].slice(-8);
  const after = masteryOf(nextDays.length);
  return {
    state: { ...s, atlas: { ...s.atlas, [key]: { days: nextDays } } },
    ev: { key, id, kind, isNew: !prev, masteryUp: after > before && prev ? after : null },
  };
}

export function isDiscovered(s: SaveState, kind: CardKind, id: string): boolean {
  return !!s.atlas[cardKey(kind, id)];
}

export function regionProgress(s: SaveState, regionId: string): { have: number; total: number; ids: string[] } {
  const r = ATLAS_REGIONS.find((x) => x.id === regionId)!;
  const ids = pool(r.topic, r.kind === 'flag').map((x) => x.id);
  const have = ids.filter((id) => !!s.atlas[cardKey(r.kind, id)]).length;
  return { have, total: ids.length, ids };
}

/** Regions that just became complete (not yet paid). */
export function newlyCompletedRegions(s: SaveState): string[] {
  return ATLAS_REGIONS.filter((r) => !s.regionsCompleted.includes(r.id))
    .filter((r) => {
      const p = regionProgress(s, r.id);
      return p.total > 0 && p.have >= p.total;
    })
    .map((r) => r.id);
}

export function totalDiscovered(s: SaveState): number {
  return Object.keys(s.atlas).length;
}

/** Undiscovered ids for a pool, used to make the picker lean toward new cards. */
export function undiscoveredSet(s: SaveState, kind: CardKind, ids: string[]): Set<string> {
  return new Set(ids.filter((id) => !s.atlas[cardKey(kind, id)]));
}
