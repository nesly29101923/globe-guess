// A still map for backgrounds (home). Same look as the round, drawn once: it has no animated values, so the
// canvas never redraws on its own.
import { Canvas, Group, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import React, { useMemo } from 'react';
import type { Topic } from '../config/levels';
import { COUNTRIES } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M, type MapTheme } from '../theme';
import { needsWrap, WRAP, type Box, type Cam } from './camera';
import { flightPaths, graticulePath } from './shapes';
import { lodFor } from './camera';

const REGIONS: Record<string, string[]> = {
  europe: ['europe'], asia: ['asia'], africa: ['africa'], americas: ['north_america', 'south_america'], oceania: ['oceania'],
};

/** A camera framing a continent: the middle 80% of its countries, so one far-off territory does not zoom it out. */
export function regionCam(topic: Topic, box: Box): Cam {
  const rs = REGIONS[topic];
  const pts = COUNTRIES.filter((c) => c.quiz && rs?.includes(c.region)).map((c) => {
    const x = topic === 'oceania' && c.label[0] < 0 ? c.label[0] + WRAP : c.label[0];
    return [x, c.label[1]] as const;
  });
  if (!pts.length) return { ux: 25, uy: -40, w: WRAP };
  const q = (arr: number[], f: number) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.max(0, Math.round(f * (arr.length - 1))))];
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x0 = q([...xs], 0.08), x1 = q([...xs], 0.92), y0 = q([...ys], 0.08), y1 = q([...ys], 0.92);
  const s = Math.min(box.fw / Math.max(x1 - x0, 1), box.fh / Math.max(y1 - y0, 1));
  return { ux: (x0 + x1) / 2, uy: (y0 + y1) / 2, w: Math.min(WRAP, box.W / s) };
}

export function StaticMap({ width, height, box, scene, topic, cam, theme }: {
  width: number; height: number; box: Box; scene: Scene; topic: Topic | 'all'; cam: Cam; theme: MapTheme;
}) {
  const lods = useMemo(() => flightPaths(scene, topic, cam, cam, box, height), [scene, topic, cam, box, height]);
  const lod = lodFor(cam.w / box.W, scene === 'usa');
  const paths = lods[lod];
  const grat = useMemo(() => (scene === 'world' ? graticulePath() : null), [scene]);
  const s = box.W / cam.w;
  const unit = 1 / s;
  const copies = scene === 'world' && needsWrap([cam], box, height) ? [-WRAP, 0, WRAP] : [0];
  const tr = [{ translateX: box.fx - cam.ux * s }, { translateY: box.fy - cam.uy * s }, { scale: s }];
  const trShadow = [{ translateX: box.fx - cam.ux * s }, { translateY: box.fy - cam.uy * s + M.shadowOffset }, { scale: s }];
  return (
    <Canvas style={{ position: 'absolute', left: 0, top: 0, width, height }} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={[theme.seaTop, theme.seaBottom]} />
      </Rect>
      {grat ? (
        <Group transform={tr}>
          {copies.map((dx) => <Path key={dx} path={grat} color={theme.graticule} style="stroke" strokeWidth={0.8 * unit} transform={[{ translateX: dx }]} />)}
        </Group>
      ) : null}
      <Group transform={trShadow}>
        {copies.map((dx) => <Path key={dx} path={paths.scope} color={theme.shadow} transform={[{ translateX: dx }]} />)}
      </Group>
      <Group transform={tr}>
        {copies.map((dx) => (
          <Group key={dx} transform={[{ translateX: dx }]}>
            <Path path={paths.other} color={theme.other} />
            <Path path={paths.other} color={theme.otherEdge} style="stroke" strokeWidth={M.edge * 0.8 * unit} />
            <Path path={paths.scope} color={theme.land} />
            <Path path={paths.scope} color={theme.landEdge} style="stroke" strokeWidth={M.edge * unit} />
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}
