// Skia paths for the map, built once from the generated SVG paths and cached.
import { BlurStyle, FillType, Skia, type SkImage, type SkPath } from '@shopify/react-native-skia';
import type { Topic } from '../config/levels';
import { COUNTRIES, STATES } from '../data/gameData';
import type { Scene } from '../logic/types';
import { viewRect, type Box, type Cam } from './camera';

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

/** Shapes drawn around the quiz land that are not items (Canada and Mexico on the US map). */
export function backgroundIds(scene: Scene): string[] {
  return Object.keys(file(scene).background ?? {});
}

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

const TOPIC_REGIONS: Record<string, string[] | null> = {
  world: null, europe: ['europe'], asia: ['asia'], africa: ['africa'], americas: ['north_america', 'south_america'],
  oceania: ['oceania'], usa: null,
};

export type Rect4 = [number, number, number, number];

function hits(b: number[], v: Rect4, wrap: number): boolean {
  for (const dx of wrap ? [-wrap, 0, wrap] : [0]) {
    if (b[0] + dx <= v[2] && b[2] + dx >= v[0] && b[1] <= v[3] && b[3] >= v[1]) return true;
  }
  return false;
}

export function inScopeFn(topic: Topic | 'all') {
  const regions = topic === 'all' ? null : TOPIC_REGIONS[topic];
  return (c: (typeof COUNTRIES)[number]) => c.quiz && (!regions || regions.includes(c.region));
}

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

/** Run jobs in the gaps between frames, a few milliseconds at a time, after what is already queued. */
export function whenIdle(jobs: (() => void)[]) {
  enqueue(jobs);
}

/** At app start: the coarse world and US maps, used by every screen with a map. */
export function warmAllIdle() {
  const jobs: Job[] = [];
  for (const c of COUNTRIES) jobs.push(() => void itemPath('world', c.id, 2));
  jobs.push(() => void graticulePath());
  for (const s of STATES) jobs.push(() => void itemPath('usa', s.id, 2));
  const bg = Object.keys(file('usa').background ?? {});
  for (const id of bg) jobs.push(() => void itemPath('usa', id, 2));
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
