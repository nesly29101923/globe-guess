// The map, drawn like the videos: sea gradient, faint graticule, paper cut-out land with an offset shadow,
// the target in purple with a pulsing glow that turns green on the reveal. All motion runs on the UI thread.
//
// Performance. The land is never drawn as outlines here: it is painted once into images (see raster.ts) and a frame
// only moves those images. A camera move is a handful of textured rectangles, whatever the phone.
// - Land canvas: sea, the whole-world image, then the images for the place the camera left and the place it flies to.
//   It redraws only while the camera moves.
// - Glow canvas: drawn once per question, pulsed through its layer opacity (no redraw).
// - Target canvas: the one or two highlighted places as outlines (a few hundred points) and the veil.
import { BlendColor, Canvas, Circle, FilterMode, Group, Image, interpolateColors, LinearGradient, MipmapMode, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import React, { useEffect, useMemo } from 'react';
import { PixelRatio } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import type { Topic } from '../config/levels';
import { itemById } from '../data/gameData';
import type { Scene } from '../logic/types';
import { map as M, type MapTheme } from '../theme';
import { frameItem, WRAP, type Box, type Cam } from './camera';
import { FADE_IN, MAX_SHRINK, worldLayer, type ShownLayer } from './raster';
import { glowImage, itemPath } from './shapes';

type Props = {
  width: number;
  height: number;
  box: Box;
  scene: Scene;
  topic: Topic | 'all';
  cam: { readonly value: Cam };
  moving: { readonly value: number }; // 1 while the camera moves
  layers: ShownLayer[];                 // finer images of the map on top of the whole-world one, bottom first
  lastDone?: string | null;          // the place just answered: tinted while the camera leaves it
  targetId: string | null;
  target2Id?: string | null;          // a second place: the other side of a size question, or the neighbour shown on a reveal
  t2Alpha?: { readonly value: number };
  t2Reveal?: { readonly value: number }; // 0 orange, 1 green
  reveal: SharedValue<number>;      // 0 question (purple), 1 answered (green)
  targetAlpha: SharedValue<number>; // fade-in of the target
  dim: SharedValue<number>;         // veil while a flag is the question
  theme: MapTheme;
  pulse?: boolean;
};

const DBG = (globalThis as unknown as { __mapDebug?: Record<string, boolean> }).__mapDebug ?? {};
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };
const WORLD_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear }; // the world is shown much smaller than it is
const EMPTY = Skia.PathBuilder.Make().detach();
const PARKED = [{ scale: 1 }]; // transform of a canvas with nothing to show: it never changes, so the canvas never redraws
/** The second place of a size question: orange, so it never looks like the purple target or the green answer. */
export const SECOND = { fill: '#F97316', edge: '#C2410C' };

type Pt = { readonly value: { x: number; y: number } };

/** One image of the map. `show` holds how solid each layer is this frame (see below).
 *  A solid layer paints the sea behind its land, which hides the coarser layers under it. While it fades in it has
 *  no sea of its own (sea at half strength over the land below would show as a pale rectangle). */
function LayerQuad({ layer, index, show, seaA, seaB, colors }: { layer: ShownLayer; index: number; show: { readonly value: number[] }; seaA: Pt; seaB: Pt; colors: string[] }) {
  const opacity = useDerivedValue(() => show.value[index + 1] ?? 0);
  const seaOpacity = useDerivedValue(() => ((show.value[index + 1] ?? 0) >= 1 ? 1 : 0));
  return (
    <>
      <Rect x={layer.x} y={layer.y} width={layer.w} height={layer.h} opacity={seaOpacity}>
        <LinearGradient start={seaA} end={seaB} colors={colors} />
      </Rect>
      <Image image={layer.image} x={layer.x} y={layer.y} width={layer.w} height={layer.h} fit="fill" sampling={SAMPLING} opacity={opacity} />
    </>
  );
}

function MapCanvasImpl(p: Props) {
  const { fx, fy, W } = p.box;
  const usa = p.scene === 'usa';
  const world = useMemo(() => worldLayer(p.scene, p.topic, p.theme), [p.scene, p.topic, p.theme]);
  const layers = useMemo(() => p.layers.filter((l) => l.scene === p.scene), [p.layers, p.scene]);
  const target = useMemo(() => (p.targetId ? itemPath(p.scene, p.targetId) : null), [p.scene, p.targetId]);
  const target2 = useMemo(() => (p.target2Id ? itemPath(p.scene, p.target2Id) : null), [p.scene, p.target2Id]);
  const lastDone = useMemo(() => (p.lastDone ? itemPath(p.scene, p.lastDone, usa ? 2 : 1) : null), [p.scene, p.lastDone, usa]);
  const item = p.targetId ? itemById(p.targetId) : null;
  const label = item ? item.label : [0, 0];
  const tinyU = item ? Math.max(item.focus[2] - item.focus[0], item.focus[3] - item.focus[1]) : 0;
  const th = p.theme;
  const sea = useMemo(() => [th.seaTop, th.seaBottom], [th]);

  // the glow: blurred once at the size the target is shown at, then only its opacity pulses
  const glow = useMemo(() => {
    if (!target || !item || p.target2Id) return null; // two places: no glow, so neither one stands out
    const unitAtRest = frameItem(item, p.scene, p.box).w / W; // map units per dp when the target is framed
    return glowImage(target, M.glowBlur * unitAtRest, 0.5 / unitAtRest);
  }, [target, item, p.scene, p.box, W, p.target2Id]);

  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [pulse]);

  const camT = useDerivedValue(() => {
    const c = p.cam.value;
    const s = W / c.w;
    return [{ translateX: fx - c.ux * s }, { translateY: fy - c.uy * s }, { scale: s }];
  });
  // the world repeats sideways: the copy the camera is over, with one either side
  const shiftT = useDerivedValue(() => [{ translateX: usa ? 0 : Math.round(p.cam.value.ux / WRAP) * WRAP }]);
  const zero = useSharedValue(0);
  const t2a = p.t2Alpha ?? zero;
  const t2r = p.t2Reveal ?? zero;
  // The glow and target canvases follow the camera only while they show something. During a flight between two map
  // questions they show nothing, so they are not redrawn at all: one canvas per frame instead of three.
  const glowT = useDerivedValue(() => {
    if (p.targetAlpha.value <= 0.01) return PARKED;
    const c = p.cam.value;
    const s = W / c.w;
    const k = usa ? 0 : Math.round(c.ux / WRAP) * WRAP;
    return [{ translateX: fx - (c.ux - k) * s }, { translateY: fy - c.uy * s }, { scale: s }];
  });
  const targetT = useDerivedValue(() => {
    if (p.targetAlpha.value <= 0.01 && t2a.value <= 0.01) return PARKED;
    const c = p.cam.value;
    const s = W / c.w;
    const k = usa ? 0 : Math.round(c.ux / WRAP) * WRAP;
    return [{ translateX: fx - (c.ux - k) * s }, { translateY: fy - c.uy * s }, { scale: s }];
  });
  const unit = useDerivedValue(() => p.cam.value.w / W); // map units per point
  // How much of each image to draw this frame: [world, layer 0, layer 1, ...], 0 to 1.
  // - a layer the camera leaves is dropped once it is shown much smaller than painted (a coarser one takes over);
  // - a layer the camera flies to fades in as the camera reaches its size;
  // - everything under a solid layer that covers the whole screen is skipped, so the GPU fills each pixel once or
  //   twice instead of once per layer (this is what keeps cheap phones at full speed).
  const pr = PixelRatio.get();
  const rects = useMemo(() => layers.map((l) => [l.x, l.y, l.x + l.w, l.y + l.h, l.ppu, l.leaving ? 1 : 0]), [layers]);
  const { width: CW, height: CH } = p;
  const show = useDerivedValue(() => {
    const c = p.cam.value;
    const u = c.w / W;
    const x0 = c.ux - fx * u;
    const y0 = c.uy - fy * u;
    const x1 = x0 + CW * u;
    const y1 = y0 + CH * u;
    const ppu = pr / u; // screen pixels per map unit
    const out: number[] = [1];
    let covered = false;
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i];
      let a = 0;
      if (!covered && r[0] < x1 && r[2] > x0 && r[1] < y1 && r[3] > y0) {
        const size = ppu / r[4]; // 1 = shown as painted, below 1 = smaller
        if (r[5]) a = size * MAX_SHRINK >= 1 ? 1 : 0;
        else {
          const t = Math.min(1, Math.max(0, (size - FADE_IN[0]) / (FADE_IN[1] - FADE_IN[0])));
          a = t * t * (3 - 2 * t);
        }
      }
      out[i + 1] = a;
      if (a >= 1 && r[0] <= x0 && r[1] <= y0 && r[2] >= x1 && r[3] >= y1) covered = true;
    }
    out[0] = covered ? 0 : 1;
    return out;
  });
  const worldOpacity = useDerivedValue(() => show.value[0]);
  // the sea is a top-to-bottom gradient on the screen; these are the screen's top and bottom on the map, so a layer
  // can paint the very same sea behind its land
  const seaA = useDerivedValue(() => ({ x: 0, y: p.cam.value.uy - fy * unit.value }));
  const seaB = useDerivedValue(() => ({ x: 0, y: p.cam.value.uy + (p.height - fy) * unit.value }));
  const edgeW = useDerivedValue(() => M.edge * unit.value);
  const targetEdgeW = useDerivedValue(() => M.targetEdge * unit.value);
  const fillC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.target, th.correct]));
  const edgeC = useDerivedValue(() => interpolateColors(p.reveal.value, [0, 1], [th.targetEdge, th.correctEdge]));
  const fill2 = useDerivedValue(() => interpolateColors(t2r.value, [0, 1], [SECOND.fill, th.correct]));
  const edge2 = useDerivedValue(() => interpolateColors(t2r.value, [0, 1], [SECOND.edge, th.correctEdge]));
  // an invisible place costs nothing: its outline is only handed to the canvas while it can be seen
  const targetP = useDerivedValue(() => (target && p.targetAlpha.value > 0.01 ? target : EMPTY));
  const target2P = useDerivedValue(() => (target2 && t2a.value > 0.01 ? target2 : EMPTY));
  // the place just answered keeps its tint while the camera flies off (the image it leaves was painted before the answer)
  const doneP = useDerivedValue(() => (lastDone && p.moving.value > 0.5 ? lastDone : EMPTY));
  // the glow canvas is drawn once; the pulse is the layer's opacity, which costs no redraw
  const glowOpacity = useDerivedValue(() => p.targetAlpha.value * 0.85 * (1 - 0.6 * p.reveal.value));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: p.pulse === false ? 0.7 : 0.45 + 0.55 * pulse.value }));
  const ringR = useDerivedValue(() => M.ringRadius * unit.value);
  const ringW = useDerivedValue(() => 3 * unit.value);
  const tinyOpacity = useDerivedValue(() => (tinyU / unit.value < M.tinyPx ? p.targetAlpha.value : 0));
  const dimOpacity = useDerivedValue(() => p.dim.value);

  const copies = usa ? [0] : [-WRAP, 0, WRAP];
  if (DBG.noMap) return null;

  const style = { width: p.width, height: p.height, position: 'absolute' as const, left: 0, top: 0 };
  return (
    <>
      {/* 1. land: images only. Redraws while the camera moves, and each frame is a few textured rectangles */}
      <Canvas style={style} pointerEvents="none">
        <Rect x={0} y={0} width={p.width} height={p.height} opacity={worldOpacity}>
          <LinearGradient start={vec(0, 0)} end={vec(0, p.height)} colors={sea} />
        </Rect>
        <Group transform={camT}>
          {world ? (
            <Group transform={shiftT} opacity={worldOpacity}>
              {copies.map((dx) => (
                <Image key={dx} image={world.image} x={world.x + dx} y={world.y} width={world.w} height={world.h} fit="fill" sampling={WORLD_SAMPLING} />
              ))}
            </Group>
          ) : null}
          {layers.map((l, i) => <LayerQuad key={i} layer={l} index={i} show={show} seaA={seaA} seaB={seaB} colors={sea} />)}
          <Group transform={shiftT}>
            {copies.map((dx) => (
              <Group key={dx} transform={[{ translateX: dx }]}>
                <Path path={doneP} color={th.done} />
                <Path path={doneP} color={th.landEdge} style="stroke" strokeWidth={edgeW} />
              </Group>
            ))}
          </Group>
        </Group>
      </Canvas>
      {/* 2. glow + ring for tiny targets: drawn once per question, pulsed by layer opacity */}
      <Animated.View style={[style, pulseStyle]} pointerEvents="none">
      <Canvas style={style} pointerEvents="none">
        <Group transform={glowT}>
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
      {/* 3. the highlighted places and the veil behind flag questions: redraws on fade-in and reveal */}
      <Canvas style={style} pointerEvents="none">
        <Group transform={targetT}>
          {copies.map((dx) => (
            <Group key={dx} transform={[{ translateX: dx }]}>
              <Group opacity={t2a}>
                <Path path={target2P} color={fill2} />
                <Path path={target2P} color={edge2} style="stroke" strokeWidth={targetEdgeW} />
              </Group>
              <Group opacity={p.targetAlpha}>
                <Path path={targetP} color={fillC} />
                <Path path={targetP} color={edgeC} style="stroke" strokeWidth={targetEdgeW} />
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
