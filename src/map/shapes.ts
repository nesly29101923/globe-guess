// Skia paths for the map, built once from the generated SVG paths and cached.
import { FillType, Skia, type SkPath } from '@shopify/react-native-skia';
import type { Topic } from '../config/levels';
import { COUNTRIES, STATES } from '../data/gameData';
import type { Scene } from '../logic/types';

type ShapeFile = { shapes: Record<string, string>; medium?: Record<string, string>; coarse?: Record<string, string>; graticule?: string; background?: Record<string, string> };

/** Level of detail: 0 fine (zoomed in), 1 medium, 2 coarse (whole world). */
export type Lod = 0 | 1 | 2;

let world: ShapeFile | null = null;
let usa: ShapeFile | null = null;
function file(scene: Scene): ShapeFile {
  if (scene === 'world') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    if (!world) world = require('../../assets/data/world_shapes.json') as ShapeFile;
    return world;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  if (!usa) usa = require('../../assets/data/usa_shapes.json') as ShapeFile;
  return usa;
}

const pathCache = new Map<string, SkPath>();

export function itemPath(scene: Scene, id: string, lod: Lod = 0): SkPath | null {
  const key = `${scene}:${id}:${lod}`;
  const hit = pathCache.get(key);
  if (hit) return hit;
  const f = file(scene);
  const table = lod === 2 ? f.coarse : lod === 1 ? f.medium : undefined;
  const d = table?.[id] ?? f.shapes[id] ?? f.background?.[id];
  if (!d) return null;
  const raw = Skia.Path.MakeFromSVGString(d);
  if (!raw) return null;
  // even-odd: lakes and enclaves stay holes
  const p = Skia.PathBuilder.MakeFromPath(raw).setFillType(FillType.EvenOdd).detach();
  pathCache.set(key, p);
  return p;
}

function combine(key: string, scene: Scene, ids: string[], lod: Lod): SkPath {
  const hit = pathCache.get(`${key}:${lod}`);
  if (hit) return hit;
  const out = merge(scene, ids, lod);
  pathCache.set(`${key}:${lod}`, out);
  return out;
}

const TOPIC_REGIONS: Record<string, string[] | null> = {
  world: null, europe: ['europe'], asia: ['asia'], africa: ['africa'], americas: ['north_america', 'south_america'],
  oceania: ['oceania'], usa: null,
};

/** Land that belongs to the quiz (drawn white) and land around it (drawn grey), per scene and topic. */
export function scopePaths(scene: Scene, topic: Topic | 'all', lod: Lod = 0): { scope: SkPath; other: SkPath } {
  if (scene === 'usa') {
    const f = file('usa');
    return {
      scope: combine('usa:scope', 'usa', STATES.map((s) => s.id), lod),
      other: combine('usa:other', 'usa', Object.keys(f.background ?? {}), lod),
    };
  }
  const regions = topic === 'all' ? null : TOPIC_REGIONS[topic];
  const inScope = (c: (typeof COUNTRIES)[number]) => c.quiz && (!regions || regions.includes(c.region));
  return {
    scope: combine(`world:scope:${topic}`, 'world', COUNTRIES.filter(inScope).map((c) => c.id), lod),
    other: combine(`world:other:${topic}`, 'world', COUNTRIES.filter((c) => !inScope(c)).map((c) => c.id), lod),
  };
}

export type Rect4 = [number, number, number, number];

function hits(b: number[], v: Rect4, wrap: number): boolean {
  for (const dx of wrap ? [-wrap, 0, wrap] : [0]) {
    if (b[0] + dx <= v[2] && b[2] + dx >= v[0] && b[1] <= v[3] && b[3] >= v[1]) return true;
  }
  return false;
}

/** Fine detail only for what is on screen around a target view (zoomed in, most of the world is off-screen). */
export function visibleScopePaths(scene: Scene, topic: Topic | 'all', view: Rect4): { scope: SkPath; other: SkPath } {
  const wrap = scene === 'world' ? 2 * Math.PI * 100 : 0;
  const key = `vis:${scene}:${topic}:${view.map((x) => Math.round(x)).join(',')}`;
  const all = scene === 'usa' ? STATES : COUNTRIES;
  if (scene === 'usa') {
    const f = file('usa');
    const bg = Object.keys(f.background ?? {});
    return {
      scope: combine(`${key}:s`, 'usa', all.filter((x) => hits(x.bbox, view, 0)).map((x) => x.id), 0),
      other: combine(`${key}:o`, 'usa', bg, 1),
    };
  }
  const regions = topic === 'all' ? null : TOPIC_REGIONS[topic];
  const inScope = (c: (typeof COUNTRIES)[number]) => c.quiz && (!regions || regions.includes(c.region));
  const vis = COUNTRIES.filter((c) => hits(c.bbox, view, wrap));
  return {
    scope: combine(`${key}:s`, 'world', vis.filter(inScope).map((c) => c.id), 0),
    other: combine(`${key}:o`, 'world', vis.filter((c) => !inScope(c)).map((c) => c.id), 0),
  };
}

export function graticulePath(): SkPath | null {
  const hit = pathCache.get('graticule');
  if (hit) return hit;
  const d = file('world').graticule;
  const p = d ? Skia.Path.MakeFromSVGString(d) : null;
  if (p) pathCache.set('graticule', p);
  return p;
}

/** Areas already answered in this round (tinted). */
export function donePath(scene: Scene, ids: string[], lod: Lod = 1): SkPath {
  return merge(scene, ids, lod);
}

function merge(scene: Scene, ids: string[], lod: Lod): SkPath {
  const b = Skia.PathBuilder.Make();
  for (const id of ids) {
    const p = itemPath(scene, id, lod);
    if (p) b.addPath(p);
  }
  b.setFillType(FillType.EvenOdd);
  return b.detach();
}

/** Warm the caches before the first question so nothing hitches. */
export function warmScene(scene: Scene, topic: Topic | 'all') {
  for (const l of [0, 1, 2] as Lod[]) scopePaths(scene, topic, l);
  if (scene === 'world') graticulePath();
}
