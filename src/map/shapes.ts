// Skia paths for the map, built once from the generated SVG paths and cached.
import { BlurStyle, FillType, Skia, type SkImage, type SkPath } from '@shopify/react-native-skia';
import type { Topic } from '../config/levels';
import { COUNTRIES, STATES } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M } from '../theme';
import { lodFor, viewRect, zoomAt, type Box, type Cam } from './camera';

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

/** One LOD's land: quiz land (white) and land around it (grey). */
export type LodPaths = { scope: SkPath; other: SkPath };

function inScopeFn(topic: Topic | 'all') {
  const regions = topic === 'all' ? null : TOPIC_REGIONS[topic];
  return (c: (typeof COUNTRIES)[number]) => c.quiz && (!regions || regions.includes(c.region));
}

/** Land for one camera flight. A zoomed-in camera shows a small part of the world, so the fine and medium levels of
 *  detail only hold the countries that can be on screen while that level is drawn (sampled along the flight).
 *  The coarse level is the whole map and is cached. Drawing the whole world at fine detail every frame was the
 *  main cost of a camera move. */
export function flightPaths(scene: Scene, topic: Topic | 'all', from: Cam, to: Cam, box: Box, H: number): LodPaths[] {
  const coarse = scopePaths(scene, topic, 2);
  const usa = scene === 'usa';
  const rects: Rect4[][] = [[], []];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const c = zoomAt(from, to, i / N, M.zoomCurve);
    const lod = lodFor(c.w / box.W, usa);
    if (lod === 2) continue;
    const r = viewRect(c, box, H);
    const m = 0.25 * (r[2] - r[0]);
    rects[lod].push([r[0] - m, r[1] - m, r[2] + m, r[3] + m]);
  }
  const wrap = usa ? 0 : 2 * Math.PI * 100;
  const pick = (lod: 0 | 1): LodPaths => {
    const rs = rects[lod];
    if (!rs.length) return EMPTY;
    const all = usa ? STATES : COUNTRIES;
    const vis = all.filter((x) => rs.some((r) => hits(x.bbox, r, wrap)));
    if (usa) {
      const f = file('usa');
      const bg = Object.keys(f.background ?? {});
      return { scope: merge('usa', vis.map((x) => x.id), lod), other: combine('usa:other', 'usa', bg, lod) };
    }
    const inScope = inScopeFn(topic);
    const cs = vis as (typeof COUNTRIES)[number][];
    return { scope: merge('world', cs.filter(inScope).map((c) => c.id), lod), other: merge('world', cs.filter((c) => !inScope(c)).map((c) => c.id), lod) };
  };
  return [pick(0), usa ? EMPTY : pick(1), coarse];
}

const EMPTY: LodPaths = { scope: Skia.PathBuilder.Make().detach(), other: Skia.PathBuilder.Make().detach() };

/** The soft glow under the target, blurred once into a small image instead of blurring the path every frame.
 *  `sigma` is the blur in map units, `pxPerUnit` the image resolution. Returns the image and where it goes on the map. */
export function glowImage(path: SkPath, sigma: number, pxPerUnit: number): { image: SkImage; x: number; y: number; w: number; h: number } | null {
  try {
    const b = path.getBounds();
    const pad = sigma * 3;
    const x = b.x - pad;
    const y = b.y - pad;
    const w = b.width + 2 * pad;
    const h = b.height + 2 * pad;
    const k = Math.min(pxPerUnit, 256 / Math.max(w, h, 1e-6));
    const pw = Math.max(4, Math.ceil(w * k));
    const ph = Math.max(4, Math.ceil(h * k));
    const surface = Skia.Surface.Make(pw, ph);
    if (!surface) return null;
    const canvas = surface.getCanvas();
    canvas.scale(k, k);
    canvas.translate(-x, -y);
    const paint = Skia.Paint();
    paint.setColor(Skia.Color('#FFFFFF'));
    paint.setAntiAlias(true);
    paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, sigma, true));
    canvas.drawPath(path, paint);
    surface.flush();
    const image = surface.makeImageSnapshot();
    return { image, x, y, w: pw / k, h: ph / k };
  } catch {
    return null;
  }
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

/** Warm the caches before the first question so nothing hitches: the coarse whole map and the graticule.
 *  Fine and medium detail is built per flight, for the part of the map the camera will show. */
export function warmScene(scene: Scene, topic: Topic | 'all') {
  scopePaths(scene, topic, 2);
  if (scene === 'world') graticulePath();
}

// ---------------------------------------------------------------- background warm-up
// Parsing a country's SVG path is the expensive step (the fine world file is 1.25 MB). Done on the spot, the first
// flight over a region parsed dozens of countries in one frame and the game froze for a moment. Instead the work is
// queued and done in slices of a few milliseconds between frames, before it is needed.

type Job = () => void;
const queue: Job[] = [];
let running = false;
const SLICE_MS = 4;

function pump() {
  const t0 = Date.now();
  while (queue.length && Date.now() - t0 < SLICE_MS) queue.shift()!();
  if (queue.length) setTimeout(pump, 0);
  else running = false;
}

function enqueue(jobs: Job[], front = false) {
  if (front) queue.unshift(...jobs);
  else queue.push(...jobs);
  if (!running) {
    running = true;
    setTimeout(pump, 0);
  }
}

/** At app start: the coarse world and US maps, used by every screen with a map. */
export function warmAllIdle() {
  const jobs: Job[] = [];
  for (const c of COUNTRIES) jobs.push(() => void itemPath('world', c.id, 2));
  jobs.push(() => scopePaths('world', 'all', 2));
  jobs.push(() => void graticulePath());
  for (const s of STATES) jobs.push(() => void itemPath('usa', s.id, 2));
  const bg = Object.keys(file('usa').background ?? {});
  for (const id of bg) jobs.push(() => void itemPath('usa', id, 2));
  jobs.push(() => scopePaths('usa', 'usa', 2));
  enqueue(jobs);
}

/** Before a round: fine and medium detail around each question's target, nearest question first. */
export function warmViews(views: { scene: Scene; cam: Cam }[], box: Box, H: number) {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const v of views) {
    const usa = v.scene === 'usa';
    const all = usa ? STATES : COUNTRIES;
    const r = viewRect(v.cam, box, H);
    const m = 0.6 * (r[2] - r[0]);
    const rect: Rect4 = [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
    const wrap = usa ? 0 : 2 * Math.PI * 100;
    for (const x of all) {
      if (!hits(x.bbox, rect, wrap)) continue;
      for (const lod of usa ? [0] : [0, 1]) {
        const k = `${v.scene}:${x.id}:${lod}`;
        if (seen.has(k) || pathCache.has(k)) continue;
        seen.add(k);
        jobs.push(() => void itemPath(v.scene, x.id, lod as Lod));
      }
    }
  }
  enqueue(jobs, true);
}
