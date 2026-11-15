// Camera maths, ported from the studio's geo.py: framing a target and the van Wijk smooth zoom (d3.interpolateZoom).
// Functions marked 'worklet' run on the UI thread.
import { map as M } from '../theme';
import type { Item, Scene } from '../logic/types';

export type Cam = { ux: number; uy: number; w: number };
export type Box = { fx: number; fy: number; fw: number; fh: number; W: number };

export const K = 100;
export const WRAP = 2 * Math.PI * K;

export function mercY(lat: number): number {
  const l = Math.max(-84, Math.min(84, lat));
  return -Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 180 / 2)) * K;
}

/** Frame an item in the focus box. minKm is the closest zoom (view width in km). */
export function frameItem(it: Item, scene: Scene, box: Box, fill: number = M.targetFill, minKm?: number): Cam {
  const [x0, y0, x1, y1] = it.focus;
  const tw = Math.max(x1 - x0, 1e-6);
  const th = Math.max(y1 - y0, 1e-6);
  const s = Math.min((fill * box.fw) / tw, (fill * box.fh) / th);
  let km = minKm ?? (scene === 'usa' ? M.minKm.state : M.minKm.country);
  if ((it.areaKm2 ?? Infinity) < M.tinyKm2) km *= M.tinyFactor;
  const minW = km / Math.max(it.kmu, 1e-6);
  let w = Math.max(box.W / s, minW);
  if (scene === 'world') w = Math.min(w, M.maxWorldShare * WRAP);
  return { ux: (x0 + x1) / 2, uy: (y0 + y1) / 2, w };
}

/** Wide view used behind flag questions and as the first camera position. */
export function neutralCam(scene: Scene): Cam {
  if (scene === 'usa') return { ux: 0, uy: -2, w: 105 };
  return { ux: 25, uy: mercY(22), w: WRAP * 1.05 };
}

export function widen(c: Cam, f: number): Cam {
  return { ux: c.ux, uy: c.uy, w: c.w * f };
}

/** Shortest way around the world: move the target copy next to the start. */
export function unwrapTowards(from: Cam, to: Cam, scene: Scene): Cam {
  if (scene !== 'world') return to;
  const k = Math.round((from.ux - to.ux) / WRAP);
  return k ? { ...to, ux: to.ux + k * WRAP } : to;
}

/** Length of the van Wijk path (used to time the move). */
export function zoomLength(a: Cam, b: Cam, rho = M.zoomCurve): number {
  const dx = b.ux - a.ux;
  const dy = b.uy - a.uy;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) return Math.abs(Math.log(b.w / a.w) / rho);
  const d1 = Math.sqrt(d2);
  const r2 = rho * rho;
  const r4 = r2 * r2;
  const b0 = (b.w * b.w - a.w * a.w + r4 * d2) / (2 * a.w * r2 * d1);
  const b1 = (b.w * b.w - a.w * a.w - r4 * d2) / (2 * b.w * r2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  return Math.abs((r1 - r0) / rho);
}

/** Camera at t in [0,1] along the smooth zoom from a to b. */
export function zoomAt(a: Cam, b: Cam, t: number, rho: number): Cam {
  'worklet';
  const dx = b.ux - a.ux;
  const dy = b.uy - a.uy;
  const d2 = dx * dx + dy * dy;
  if (d2 < 1e-12) {
    const S = Math.log(b.w / a.w) / rho;
    return { ux: a.ux + t * dx, uy: a.uy + t * dy, w: a.w * Math.exp(rho * t * S) };
  }
  const d1 = Math.sqrt(d2);
  const r2 = rho * rho;
  const r4 = r2 * r2;
  const b0 = (b.w * b.w - a.w * a.w + r4 * d2) / (2 * a.w * r2 * d1);
  const b1 = (b.w * b.w - a.w * a.w - r4 * d2) / (2 * b.w * r2 * d1);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const S = (r1 - r0) / rho;
  const s = t * S;
  const c0 = Math.cosh(r0);
  const u = (a.w / (r2 * d1)) * (c0 * Math.tanh(rho * s + r0) - Math.sinh(r0));
  return { ux: a.ux + u * dx, uy: a.uy + u * dy, w: (a.w * c0) / Math.cosh(rho * s + r0) };
}

export function easeInOut(t: number): number {
  'worklet';
  const x = Math.max(0, Math.min(1, t));
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Does a camera (or a move between two) show beyond the world's edge, so the wrapped copies are needed? */
export function needsWrap(cams: Cam[], box: Box, H: number): boolean {
  for (const c of cams) {
    const s = box.W / c.w;
    const left = c.ux - box.fx / s;
    const right = c.ux + (box.W - box.fx) / s;
    if (left < -WRAP / 2 || right > WRAP / 2) return true;
    void H;
  }
  return false;
}
