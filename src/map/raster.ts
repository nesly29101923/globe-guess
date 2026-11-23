// The map as textures. This is what makes the map cheap to draw.
//
// Drawing the land as vector outlines costs the phone tens of thousands of points per frame, and a camera move is
// 60 such frames a second. Here the land is painted ONCE into images, on the JS thread (never the drawing thread):
// - a world layer: the whole map at low resolution, used while the camera is far out or on the way;
// - a view layer: exactly what a camera position shows, pixel for pixel, so the map at rest is as sharp as vectors.
// A frame is then a handful of images moved by the camera transform.
import { PaintStyle, Skia, type SkCanvas, type SkImage, type SkPaint } from '@shopify/react-native-skia';
import { PixelRatio } from 'react-native';
import type { Topic } from '../config/levels';
import { COUNTRIES, STATES } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M, type MapTheme } from '../theme';
import { lodFor, WORLD_TOP, WRAP, type Box, type Cam } from './camera';
import { backgroundIds, graticulePath, inScopeFn, itemPath, whenIdle, type Lod, type Rect4 } from './shapes';

/** An image of the map, where it sits in map units, and how fine it is (image pixels per map unit). */
export type Layer = { image: SkImage; x: number; y: number; w: number; h: number; ppu: number; scene: Scene };
/** What the map shows at one camera position: the exact view, and a coarser image of the land around it. */
export type Stop = { view: Layer; around: Layer | null };
/** A layer on screen. `leaving`: the camera is flying away from it. */
export type ShownLayer = Layer & { leaving?: boolean };

const MAX_VIEW_PX = 4_600_000;   // a view layer never has more pixels than this (large tablets render a little softer)
const MARGIN = 0.02;             // a view layer extends this share of the screen beyond the view on each side
const AROUND_SPAN = 2.6;         // the image around a view covers this many screens each way...
const MAX_AROUND_PX = 2_200_000; // ...with at most this many pixels
/** A layer the camera is leaving is drawn until it is this many times smaller than painted (smaller would shimmer). */
export const MAX_SHRINK = 2.2;
/** A layer the camera flies to fades in between these sizes (1 = as painted): the land sharpens as the camera
 *  arrives, instead of a sharp rectangle growing in the middle of a soft picture. */
export const FADE_IN = [0.68, 0.92] as const;

type DrawOpts = {
  scene: Scene; topic: Topic | 'all'; theme: MapTheme; lod: Lod;
  rect: Rect4;        // map units covered
  ppu: number;        // pixels per map unit
  dp: number;         // pixels per screen point: line widths and the shadow offset are given in points
  done?: string[];
};

function fill(color: string): SkPaint {
  const p = Skia.Paint();
  p.setAntiAlias(true);
  p.setColor(Skia.Color(color));
  return p;
}
function stroke(color: string, width: number): SkPaint {
  const p = fill(color);
  p.setStyle(PaintStyle.Stroke);
  p.setStrokeWidth(width);
  return p;
}

/** The land as a list of small drawing steps (one outline each), so a big image can be painted a few at a time. */
function landSteps(c: SkCanvas, o: DrawOpts): (() => void)[] {
  const { scene, theme: th, rect, ppu, lod } = o;
  const usa = scene === 'usa';
  const u = o.dp / ppu; // one screen point in map units
  const px = 1 / ppu;   // one pixel of this image: no line is thinner, or it would fade away in the coarse layers
  const steps: (() => void)[] = [];
  steps.push(() => {
    c.scale(ppu, ppu);
    c.translate(-rect[0], -rect[1]);
  });
  // the world repeats sideways: which copies of it touch this rectangle
  const ks: number[] = [];
  if (usa) ks.push(0);
  else for (let k = Math.floor((rect[0] + WRAP / 2) / WRAP) - 1; k <= Math.floor((rect[2] + WRAP / 2) / WRAP) + 1; k++) ks.push(k);
  const pad = 6 * u;
  const visible = (b: number[], k: number) => b[0] + k * WRAP <= rect[2] + pad && b[2] + k * WRAP >= rect[0] - pad && b[1] <= rect[3] + pad && b[3] >= rect[1] - pad;

  const inScope = usa ? () => true : inScopeFn(o.topic);
  const items = usa ? STATES : COUNTRIES;
  type Ref = { id: string; k: number };
  const scope: Ref[] = [];
  const other: Ref[] = [];
  for (const it of items) {
    const list = inScope(it as (typeof COUNTRIES)[number]) ? scope : other;
    for (const k of ks) if (visible(it.bbox, k)) list.push({ id: it.id, k });
  }
  if (usa) for (const id of backgroundIds('usa')) other.push({ id, k: 0 });

  const each = (list: Ref[], paint: SkPaint, dy = 0) => {
    for (const { id, k } of list) {
      steps.push(() => {
        const p = itemPath(scene, id, lod);
        if (!p) return;
        if (k === 0 && dy === 0) return c.drawPath(p, paint);
        c.save();
        c.translate(k * WRAP, dy);
        c.drawPath(p, paint);
        c.restore();
      });
    }
  };

  if (!usa) {
    const gp = stroke(th.graticule, Math.max(0.8 * u, 0.8 * px));
    for (const k of ks) {
      steps.push(() => {
        const g = graticulePath();
        if (!g) return;
        c.save();
        c.translate(k * WRAP, 0);
        c.drawPath(g, gp);
        c.restore();
      });
    }
  }
  // paper cut-out: the quiz land's shadow, a few points below it
  each(scope, fill(th.shadow), M.shadowOffset * u);
  each(other, fill(th.other));
  each(other, stroke(th.otherEdge, Math.max(M.edge * 0.8 * u, px)));
  each(scope, fill(th.land));
  each(scope, stroke(th.landEdge, Math.max(M.edge * u, px)));
  if (o.done?.length) {
    const ids = new Set(o.done);
    const done = [...scope, ...other].filter((x) => ids.has(x.id));
    each(done, fill(th.done));
    each(done, stroke(th.landEdge, Math.max(M.edge * u, px)));
  }
  return steps;
}

/** Painting times, newest last (read by the automated play sessions). */
export const paintLog: { ms: number; px: number; lod: Lod }[] = [];
if (typeof document !== 'undefined') (globalThis as unknown as Record<string, unknown>).__paintLog = paintLog;

type Disposable = { dispose?: () => void };

function paint(wPx: number, hPx: number, o: DrawOpts): SkImage | null {
  try {
    const t0 = performance.now();
    const surface = Skia.Surface.Make(wPx, hPx);
    if (!surface) return null;
    for (const step of landSteps(surface.getCanvas(), o)) step();
    surface.flush();
    const image = surface.makeImageSnapshot();
    (surface as unknown as Disposable).dispose?.();
    paintLog.push({ ms: Math.round(performance.now() - t0), px: wPx * hPx, lod: o.lod });
    if (paintLog.length > 60) paintLog.shift();
    return image;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- world layers (one per scene, colouring and theme)

// The world is painted finer than a screen needs when it shows the whole map, because the camera also sees it
// zoomed in: right after leaving a place and just before reaching one. 4096 is every phone GPU's safe texture width.
const WORLD_PX = PixelRatio.get() >= 2.5 ? 4096 : 3072;
const USA_PX = 2048;

type World = { layer: Layer | null; used: number; finish: () => Layer | null };
const worlds = new Map<string, World>();
let clock = 0;

function usaBounds(): Rect4 {
  let b: Rect4 = [Infinity, Infinity, -Infinity, -Infinity];
  const add = (x0: number, y0: number, x1: number, y1: number) => (b = [Math.min(b[0], x0), Math.min(b[1], y0), Math.max(b[2], x1), Math.max(b[3], y1)]);
  for (const s of STATES) add(s.bbox[0], s.bbox[1], s.bbox[2], s.bbox[3]);
  for (const id of backgroundIds('usa')) {
    const r = itemPath('usa', id, 2)?.getBounds();
    if (r) add(r.x, r.y, r.x + r.width, r.y + r.height);
  }
  return b;
}

/** Start a world layer. It is painted step by step: by `finish()` at once, or a few steps at a time by `step()`. */
function startWorld(scene: Scene, topic: Topic | 'all', theme: MapTheme): World & { step: () => void } {
  const rect: Rect4 = scene === 'world' ? [-WRAP / 2, WORLD_TOP, WRAP / 2, 128] : usaBounds();
  const w = rect[2] - rect[0];
  const wPx = scene === 'world' ? WORLD_PX : USA_PX;
  const ppu = wPx / w;
  const hPx = Math.min(4096, Math.ceil((rect[3] - rect[1]) * ppu));
  let surface: ReturnType<typeof Skia.Surface.Make> = null;
  let steps: (() => void)[] = [];
  let at = 0;
  let spent = 0;
  let failed = false;
  const one = () => {
    const t0 = performance.now();
    try {
      if (!surface) {
        surface = Skia.Surface.Make(wPx, hPx);
        if (!surface) throw new Error('no surface');
        steps = landSteps(surface.getCanvas(), { scene, topic, theme, lod: 2, rect, ppu, dp: 1 });
      } else if (at < steps.length) steps[at++]();
      if (surface && at >= steps.length && !world.layer) {
        surface.flush();
        world.layer = { image: surface.makeImageSnapshot(), x: rect[0], y: rect[1], w, h: hPx / ppu, ppu, scene };
        (surface as unknown as Disposable).dispose?.();
        paintLog.push({ ms: Math.round(spent + performance.now() - t0), px: wPx * hPx, lod: 2 });
      }
    } catch {
      failed = true;
    }
    spent += performance.now() - t0;
  };
  const world: World & { step: () => void } = {
    layer: null,
    used: ++clock,
    step: () => {
      if (!world.layer && !failed) one();
    },
    finish: () => {
      while (!world.layer && !failed) one();
      return world.layer;
    },
  };
  return world;
}

const worldKey = (scene: Scene, topic: Topic | 'all', theme: MapTheme) => `${scene}:${scene === 'usa' ? 'usa' : topic}:${theme.id}`;

function worldFor(scene: Scene, topic: Topic | 'all', theme: MapTheme): World & { step?: () => void } {
  const key = worldKey(scene, topic, theme);
  let hit = worlds.get(key);
  if (!hit) {
    hit = startWorld(scene, topic, theme);
    worlds.set(key, hit);
    // a few stay cached (world, USA, another theme); older ones are dropped and freed with the garbage
    if (worlds.size > 3) {
      const oldest = [...worlds.entries()].filter(([k]) => k !== key).sort((a, b) => a[1].used - b[1].used)[0];
      worlds.delete(oldest[0]);
    }
  }
  hit.used = ++clock;
  return hit;
}

/** The whole map as one image. Shown wherever no finer layer is: far out, and on the way between two places. */
export function worldLayer(scene: Scene, topic: Topic | 'all', theme: MapTheme): Layer | null {
  return worldFor(scene, topic, theme).finish();
}

/** Paint a world layer before it is needed, a few milliseconds at a time between frames (see whenIdle). */
export function prewarmWorld(scene: Scene, topic: Topic | 'all', theme: MapTheme) {
  const w = worldFor(scene, topic, theme) as World & { step: () => void; queued?: boolean };
  if (w.layer || w.queued) return;
  w.queued = true;
  const job = () => {
    if (w.layer) return;
    w.step();
    if (!w.layer) whenIdle([job]);
  };
  whenIdle([job]);
}

// ---------------------------------------------------------------- view layers

export type ViewSpec = { scene: Scene; topic: Topic | 'all'; theme: MapTheme; cam: Cam; box: Box; width: number; height: number; done?: string[] };

const norm = (x: number) => x - Math.round(x / WRAP) * WRAP;

function specKey(s: ViewSpec): string {
  const c = s.cam;
  const ux = s.scene === 'world' ? norm(c.ux) : c.ux;
  return `${s.scene}:${s.topic}:${s.theme.id}:${ux.toFixed(2)}:${c.uy.toFixed(2)}:${c.w.toFixed(2)}:${s.width}x${s.height}:${(s.done ?? []).join(',')}`;
}

/** Paint what a camera shows, `span` screens wide and high around the middle of the screen, with at most maxPx pixels. */
function renderRect(s: ViewSpec, span: number, marginPx: number, maxPx: number): Layer | null {
  const { cam, box } = s;
  let pr = PixelRatio.get() / span;
  let m = Math.round(marginPx * pr);
  const total = (s.width * span * pr + 2 * m) * (s.height * span * pr + 2 * m);
  if (total > maxPx) {
    const f = Math.sqrt(maxPx / total);
    pr *= f;
    m = Math.round(m * f);
  }
  const upp = cam.w / box.W; // map units per screen point
  const ppu = pr / upp;      // image pixels per map unit
  // the screen's rectangle on the map, grown to `span` screens around its middle
  const cx = cam.ux + (s.width / 2 - box.fx) * upp;
  const cy = cam.uy + (s.height / 2 - box.fy) * upp;
  const wPx = Math.ceil(s.width * span * pr) + 2 * m;
  const hPx = Math.ceil(s.height * span * pr) + 2 * m;
  // the image's pixel (m, m) is the screen's top-left pixel when span is 1: at rest the layer sits exactly on the
  // screen's pixels and is as sharp as drawing the outlines
  const x0 = cx - (s.width * span * upp) / 2 - m / ppu;
  const y0 = cy - (s.height * span * upp) / 2 - m / ppu;
  const rect: Rect4 = [x0, y0, x0 + wPx / ppu, y0 + hPx / ppu];
  const usa = s.scene === 'usa';
  const image = paint(wPx, hPx, {
    scene: s.scene, topic: s.topic, theme: s.theme, lod: lodFor(PixelRatio.get() / ppu, usa) as Lod, rect, ppu, dp: pr, done: s.done,
  });
  return image ? { image, x: x0, y: y0, w: wPx / ppu, h: hPx / ppu, ppu, scene: s.scene } : null;
}

/** Only the exact view (used for the sharper image after the player zoomed in). */
export function renderView(s: ViewSpec): Layer | null {
  return renderRect(s, 1, Math.max(s.width, s.height) * MARGIN, MAX_VIEW_PX);
}

/** Everything the map needs at one camera position. 15-80 ms on the JS thread; the drawing thread is not touched. */
export function renderStop(s: ViewSpec): Stop | null {
  const view = renderRect(s, 1, Math.max(s.width, s.height) * MARGIN, MAX_VIEW_PX);
  if (!view) return null;
  // the land around the view, coarser: what the camera sees first when it pulls back. Not needed when the world
  // layer is already as fine as it would be.
  const world = worldLayer(s.scene, s.topic, s.theme);
  let around = renderRect(s, AROUND_SPAN, 0, MAX_AROUND_PX);
  if (around && world && around.ppu < world.ppu * 1.25) {
    retire(around, 0);
    around = null;
  }
  return { view, around };
}

// one stop painted ahead of time (the next question's view), waiting to be used
let ahead: { key: string; stop: Stop } | null = null;

export function prerenderStop(s: ViewSpec) {
  const key = specKey(s);
  if (ahead?.key === key) return;
  if (ahead) retireStop(ahead.stop);
  const stop = renderStop(s);
  ahead = stop ? { key, stop } : null;
}

/** Forget the stop painted ahead (the round is over). */
export function dropAhead() {
  if (ahead) retireStop(ahead.stop);
  ahead = null;
}

/** The stop for a view: the one painted ahead if it matches (moved next to the camera across the date line), else painted now. */
export function takeStop(s: ViewSpec): Stop | null {
  const key = specKey(s);
  if (ahead?.key !== key) return renderStop(s);
  const stop = ahead.stop;
  ahead = null;
  if (s.scene !== 'world') return stop;
  const upp = s.cam.w / s.box.W;
  const want = s.cam.ux + (s.width / 2 - s.box.fx) * upp; // middle of the screen on the map
  const move = (l: Layer): Layer => {
    const k = Math.round((want - (l.x + l.w / 2)) / WRAP);
    return k ? { ...l, x: l.x + k * WRAP } : l;
  };
  return { view: move(stop.view), around: stop.around ? move(stop.around) : null };
}

/** A layer no screen shows any more: free its pixels, a moment later so a frame in flight can still finish. */
export function retire(layer: Layer | null | undefined, afterMs = 2000) {
  if (!layer) return;
  const free = () => {
    try {
      (layer.image as unknown as { dispose?: () => void }).dispose?.();
    } catch {
      /* already gone */
    }
  };
  if (afterMs <= 0) free();
  else setTimeout(free, afterMs);
}

export function retireStop(stop: Stop | null | undefined) {
  if (!stop) return;
  retire(stop.view);
  retire(stop.around);
}
