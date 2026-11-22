// The map, drawn like the videos: sea gradient, faint graticule, paper cut-out land with an offset shadow,
// the target in purple with a pulsing glow that turns green on the reveal. All motion runs on the UI thread.
//
// Performance (60 fps on a mid-range Android phone):
// - Three canvases. The land only redraws while the camera moves. The glow canvas is drawn once per question and
//   pulses through its layer opacity (no redraw). The target canvas redraws only on fade-in and reveal.
// - Fine and medium detail hold only the countries the camera can show during this flight (see flightPaths).
// - While the camera moves, land fills skip anti-aliasing and borders are hairlines: both are far cheaper for the
//   GPU, and in motion the difference cannot be seen. At rest everything is drawn at full quality again.
// - The glow is blurred once per question into a small image (blurring a country path every frame was the
//   most expensive thing on screen during a question).
import { BlendColor, Canvas, Circle, FilterMode, Group, Image, interpolateColors, LinearGradient, MipmapMode, Path, Rect, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Topic } from '../config/levels';
import { itemById } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M, type MapTheme } from '../theme';
import { frameItem, lodFor, WRAP, type Box, type Cam } from './camera';
import { donePath, flightPaths, glowImage, graticulePath, itemPath } from './shapes';

export type Flight = { from: Cam; to: Cam };

type Props = {
  width: number;
  height: number;
  box: Box;
  scene: Scene;
  topic: Topic | 'all';
  cam: { readonly value: Cam };
  moving: { readonly value: number }; // 1 while the camera moves
  flight: Flight;                    // the current camera move: detail is built for what it shows
  targetId: string | null;
  target2Id?: string | null;          // a second place: the other side of a size question, or the neighbour shown on a reveal
  t2Alpha?: { readonly value: number };
  t2Reveal?: { readonly value: number }; // 0 orange, 1 green
  reveal: SharedValue<number>;      // 0 question (purple), 1 answered (green)
  targetAlpha: SharedValue<number>; // fade-in of the target
  dim: SharedValue<number>;         // veil while a flag is the question
  done: string[];
  wrap: boolean;
  theme: MapTheme;
  pulse?: boolean;
};

const DBG = (globalThis as unknown as { __mapDebug?: Record<string, boolean> }).__mapDebug ?? {};
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };
/** The second place of a size question: orange, so it never looks like the purple target or the green answer. */
export const SECOND = { fill: '#F97316', edge: '#C2410C' };

function MapCanvasImpl(p: Props) {
  const { fx, fy, W } = p.box;
  const lods = useMemo(() => flightPaths(p.scene, p.topic, p.flight.from, p.flight.to, p.box, p.height), [p.scene, p.topic, p.flight, p.box, p.height]);
  const grat = useMemo(() => (p.scene === 'world' ? graticulePath() : null), [p.scene]);
  const target = useMemo(() => (p.targetId ? itemPath(p.scene, p.targetId) : null), [p.scene, p.targetId]);
  const target2 = useMemo(() => (p.target2Id ? itemPath(p.scene, p.target2Id) : null), [p.scene, p.target2Id]);
  const doneP = useMemo(() => [donePath(p.scene, p.done, 0), donePath(p.scene, p.done, 1), donePath(p.scene, p.done, 2)], [p.scene, p.done]);
  const item = p.targetId ? itemById(p.targetId) : null;
  const label = item ? item.label : [0, 0];
  const tinyU = item ? Math.max(item.focus[2] - item.focus[0], item.focus[3] - item.focus[1]) : 0;
  const th = p.theme;

  // the glow: blurred once at the size the target is shown at, then only its opacity pulses
  const glow = useMemo(() => {
    if (!target || !item || p.target2Id) return null; // two places: no glow, so neither one stands out
    const unitAtRest = frameItem(item, p.scene, p.box).w / W; // map units per dp when the target is framed
    return glowImage(target, M.glowBlur * unitAtRest, 0.5 / unitAtRest);
  }, [target, item, p.scene, p.box, W]);

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);

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
  const usa = p.scene === 'usa';
  const lod = useDerivedValue(() => lodFor(unit.value, usa));
  const scope = useDerivedValue(() => lods[lod.value].scope);
  const other = useDerivedValue(() => lods[lod.value].other);
  const doneL = useDerivedValue(() => doneP[lod.value]);
  const still = useDerivedValue(() => p.moving.value < 0.5);
  const edgeW = useDerivedValue(() => (p.moving.value > 0.5 ? 0 : M.edge * unit.value));
  const otherEdgeW = useDerivedValue(() => (p.moving.value > 0.5 ? 0 : M.edge * 0.8 * unit.value));
  const targetEdgeW = useDerivedValue(() => M.targetEdge * unit.value);
  const gratW = useDerivedValue(() => 0.8 * unit.value);
  const fillC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.target, th.correct]));
  const edgeC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.targetEdge, th.correctEdge]));
  const zero = useSharedValue(0);
  const t2a = p.t2Alpha ?? zero;
  const t2r = p.t2Reveal ?? zero;
  const fill2 = useDerivedValue(() => interpolateColors(t2r.value, [0, 1], [SECOND.fill, th.correct]));
  const edge2 = useDerivedValue(() => interpolateColors(t2r.value, [0, 1], [SECOND.edge, th.correctEdge]));
  // the glow canvas is drawn once; the pulse is the layer's opacity, which costs no redraw
  const glowOpacity = useDerivedValue(() => p.targetAlpha.value * 0.85 * (1 - 0.6 * p.reveal.value));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: p.pulse === false ? 0.7 : 0.45 + 0.55 * pulse.value }));
  const ringR = useDerivedValue(() => M.ringRadius * unit.value);
  const ringW = useDerivedValue(() => 3 * unit.value);
  const tinyOpacity = useDerivedValue(() => (tinyU / unit.value < M.tinyPx ? p.targetAlpha.value : 0));
  const dimOpacity = useDerivedValue(() => p.dim.value);

  const copies = p.wrap ? [-WRAP, 0, WRAP] : [0];
  if (DBG.noMap) return null;

  const style = { width: p.width, height: p.height, position: 'absolute' as const, left: 0, top: 0 };
  return (
    <>
      {/* 1. land: redraws only while the camera moves */}
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
        {!DBG.noShadow ? (
          <Group transform={shadowT}>
            {copies.map((dx) => (
              <Group key={dx} transform={[{ translateX: dx }]}>
                <Path path={scope} color={th.shadow} antiAlias={still} />
              </Group>
            ))}
          </Group>
        ) : null}
        <Group transform={camT}>
          {copies.map((dx) => (
            <Group key={dx} transform={[{ translateX: dx }]}>
              <Path path={other} color={th.other} antiAlias={still} />
              {!DBG.noStroke ? <Path path={other} color={th.otherEdge} style="stroke" strokeWidth={otherEdgeW} /> : null}
              <Path path={scope} color={th.land} antiAlias={still} />
              {!DBG.noStroke ? <Path path={scope} color={th.landEdge} style="stroke" strokeWidth={edgeW} /> : null}
              <Path path={doneL} color={th.done} />
              <Path path={doneL} color={th.landEdge} style="stroke" strokeWidth={edgeW} />
            </Group>
          ))}
        </Group>
      </Canvas>
      {/* 2. glow + ring for tiny targets: drawn once per question, pulsed by layer opacity */}
      <Animated.View style={[style, pulseStyle]} pointerEvents="none">
      <Canvas style={style} pointerEvents="none">
        <Group transform={camT}>
          {target &&
            copies.map((dx) => (
              <Group key={`g${dx}`} transform={[{ translateX: dx }]}>
                {glow && !DBG.noGlow ? (
                  <Image image={glow.image} x={glow.x} y={glow.y} width={glow.w} height={glow.h} fit="fill" sampling={SAMPLING} opacity={glowOpacity}>
                    <BlendColor color={fillC} mode="srcIn" />
                  </Image>
                ) : null}
                <Group opacity={tinyOpacity}>
                  <Circle cx={label[0]} cy={label[1]} r={ringR} color={edgeC} style="stroke" strokeWidth={ringW} />
                </Group>
              </Group>
            ))}
        </Group>
      </Canvas>
      </Animated.View>
      {/* 3. the target itself and the veil behind flag questions: redraws only on fade-in and reveal */}
      <Canvas style={style} pointerEvents="none">
        <Group transform={camT}>
          {target2 &&
            copies.map((dx) => (
              <Group key={`s${dx}`} transform={[{ translateX: dx }]} opacity={t2a}>
                <Path path={target2} color={fill2} />
                <Path path={target2} color={edge2} style="stroke" strokeWidth={targetEdgeW} />
              </Group>
            ))}
          {target &&
            copies.map((dx) => (
              <Group key={`t${dx}`} transform={[{ translateX: dx }]} opacity={p.targetAlpha}>
                <Path path={target} color={fillC} />
                <Path path={target} color={edgeC} style="stroke" strokeWidth={targetEdgeW} />
              </Group>
            ))}
        </Group>
        <Rect x={0} y={0} width={p.width} height={p.height} color={th.dark ? 'rgba(11,21,48,0.62)' : 'rgba(255,255,255,0.6)'} opacity={dimOpacity} />
      </Canvas>
    </>
  );
}

export const MapCanvas = React.memo(MapCanvasImpl);
