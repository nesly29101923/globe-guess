// The map, drawn like the videos: sea gradient, faint graticule, paper cut-out land with an offset shadow,
// the target in purple with a pulsing glow that turns green on the reveal. All motion runs on the UI thread.
import { BlurMask, Canvas, Circle, Group, interpolateColors, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Topic } from '../config/levels';
import { itemById } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M, type MapTheme } from '../theme';
import { WRAP, type Box, type Cam } from './camera';
import { donePath, graticulePath, itemPath, scopePaths, visibleScopePaths, type Rect4 } from './shapes';

type Props = {
  width: number;
  height: number;
  box: Box;
  scene: Scene;
  topic: Topic | 'all';
  cam: { readonly value: Cam };
  targetId: string | null;
  reveal: SharedValue<number>;      // 0 question (purple), 1 answered (green)
  targetAlpha: SharedValue<number>; // fade-in of the target
  dim: SharedValue<number>;         // veil while a flag is the question
  done: string[];
  wrap: boolean;
  theme: MapTheme;
  pulse?: boolean;
  view?: Rect4 | null;               // where the camera is going: fine detail is built for this area only
};

const DBG = (globalThis as unknown as { __mapDebug?: Record<string, boolean> }).__mapDebug ?? {};

function MapCanvasImpl(p: Props) {
  const base = useMemo(() => [0, 1, 2].map((l) => scopePaths(p.scene, p.topic, l as 0 | 1 | 2)), [p.scene, p.topic]);
  const viewKey = p.view ? p.view.map((x) => Math.round(x)).join(',') : '';
  const fine = useMemo(() => (p.view ? visibleScopePaths(p.scene, p.topic, p.view) : base[0]), [p.scene, p.topic, viewKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const lods = useMemo(() => [fine, base[1], base[2]], [fine, base]);
  const grat = useMemo(() => (p.scene === 'world' ? graticulePath() : null), [p.scene]);
  const target = useMemo(() => (p.targetId ? itemPath(p.scene, p.targetId) : null), [p.scene, p.targetId]);
  const doneP = useMemo(() => [donePath(p.scene, p.done, 0), donePath(p.scene, p.done, 1), donePath(p.scene, p.done, 2)], [p.scene, p.done]);
  const item = p.targetId ? itemById(p.targetId) : null;
  const label = item ? item.label : [0, 0];
  const tinyU = item ? Math.max(item.focus[2] - item.focus[0], item.focus[3] - item.focus[1]) : 0;
  const { fx, fy, W } = p.box;
  const th = p.theme;

  const glow = useSharedValue(0.5);
  useEffect(() => {
    glow.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [glow]);

  const camT = useDerivedValue(() => {
    const c = p.cam.value;
    const s = W / c.w;
    return [{ translateX: fx - c.ux * s }, { translateY: fy - c.uy * s }, { scale: s }];
  });
  const shadowT = useDerivedValue(() => {
    const c = p.cam.value;
    const s = W / c.w;
    return [{ translateX: fx - c.ux * s }, { translateY: fy - c.uy * s + M.shadowOffset }, { scale: s }];
  });
  const unit = useDerivedValue(() => p.cam.value.w / W); // projected units per pixel
  // level of detail: a pixel of a zoomed-out world covers many projected units, so draw fewer points
  const usa = p.scene === 'usa';
  const lod = useDerivedValue(() => (usa ? (unit.value < 0.12 ? 0 : 2) : unit.value < 0.12 ? 0 : unit.value < 0.45 ? 1 : 2));
  const scope = useDerivedValue(() => lods[lod.value].scope);
  const other = useDerivedValue(() => lods[lod.value].other);
  const doneL = useDerivedValue(() => doneP[lod.value]);
  const edgeW = useDerivedValue(() => M.edge * unit.value);
  const otherEdgeW = useDerivedValue(() => M.edge * 0.8 * unit.value);
  const targetEdgeW = useDerivedValue(() => M.targetEdge * unit.value);
  const gratW = useDerivedValue(() => 0.8 * unit.value);
  const fillC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.target, th.correct]));
  const edgeC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.targetEdge, th.correctEdge]));
  const glowOpacity = useDerivedValue(() => p.targetAlpha.value * (p.pulse === false ? 0.5 : 0.25 + 0.4 * glow.value) * (1 - 0.6 * p.reveal.value));
  const glowBlur = useDerivedValue(() => M.glowBlur * unit.value);
  const ringR = useDerivedValue(() => (M.ringRadius + 4 * glow.value * (1 - p.reveal.value)) * unit.value);
  const ringW = useDerivedValue(() => 3 * unit.value);
  const tinyOpacity = useDerivedValue(() => (tinyU / unit.value < M.tinyPx ? p.targetAlpha.value : 0));
  const dimOpacity = useDerivedValue(() => p.dim.value);

  const copies = p.wrap ? [-WRAP, 0, WRAP] : [0];
  if (DBG.noMap) return null;

  const land = (fill: boolean) =>
    copies.map((dx) => (
      <Group key={`${fill}-${dx}`} transform={[{ translateX: dx }]}>
        {fill ? (
          <>
            <Path path={other} color={th.other} />
            {!DBG.noStroke ? <Path path={other} color={th.otherEdge} style="stroke" strokeWidth={otherEdgeW} /> : null}
            <Path path={scope} color={th.land} />
            {!DBG.noStroke ? <Path path={scope} color={th.landEdge} style="stroke" strokeWidth={edgeW} /> : null}
            <Path path={doneL} color={th.done} />
            <Path path={doneL} color={th.landEdge} style="stroke" strokeWidth={edgeW} />
          </>
        ) : (
          <>
            <Path path={other} color={th.shadow} />
            <Path path={scope} color={th.shadow} />
          </>
        )}
      </Group>
    ));

  // Two layers: the land only redraws while the camera moves; the pulsing target redraws every frame but is small.
  const style = { width: p.width, height: p.height, position: 'absolute' as const, left: 0, top: 0 };
  return (
    <>
      <Canvas style={style} pointerEvents="none">
        <Rect x={0} y={0} width={p.width} height={p.height}>
          <LinearGradient start={vec(0, 0)} end={vec(0, p.height)} colors={[th.seaTop, th.seaBottom]} />
        </Rect>
        {grat && (
          <Group transform={camT}>
            {copies.map((dx) => (
              <Group key={dx} transform={[{ translateX: dx }]}>
                <Path path={grat} color={th.graticule} style="stroke" strokeWidth={gratW} />
              </Group>
            ))}
          </Group>
        )}
        {!DBG.noShadow ? <Group transform={shadowT}>{land(false)}</Group> : null}
        <Group transform={camT}>{land(true)}</Group>
      </Canvas>
      <Canvas style={style} pointerEvents="none">
        <Group transform={camT}>
          {target &&
            copies.map((dx) => (
              <Group key={`t${dx}`} transform={[{ translateX: dx }]} opacity={p.targetAlpha}>
                {!DBG.noGlow ? (
                  <Group opacity={glowOpacity}>
                    <Path path={target} color={fillC}>
                      <BlurMask blur={glowBlur} style="normal" />
                    </Path>
                  </Group>
                ) : null}
                <Path path={target} color={fillC} />
                <Path path={target} color={edgeC} style="stroke" strokeWidth={targetEdgeW} />
                <Group opacity={tinyOpacity}>
                  <Circle cx={label[0]} cy={label[1]} r={ringR} color={edgeC} style="stroke" strokeWidth={ringW} />
                </Group>
              </Group>
            ))}
        </Group>
        <Rect x={0} y={0} width={p.width} height={p.height} color={th.dark ? 'rgba(11,21,48,0.62)' : 'rgba(255,255,255,0.6)'} opacity={dimOpacity} />
      </Canvas>
    </>
  );
}

export const MapCanvas = React.memo(MapCanvasImpl);
