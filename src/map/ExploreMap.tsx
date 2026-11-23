// The map on the menu: a globe to play with. Drag it, pinch it; it keeps gliding when let go. Tap a country and it
// lifts out of the map in the target colour, the camera glides to it and a card shows its flag, capital and size.
// (In a round the camera is the game's; the player does not move the map there.)
//
// It is drawn from the same images as the round (raster.ts): while it moves, the whole-world image; when it comes
// to rest, an image of exactly that view at the screen's pixels fades in. A frame is one or two textured rectangles.
import { Canvas, Circle, FilterMode, Group, Image, LinearGradient, MipmapMode, Path, Rect, Skia, vec } from '@shopify/react-native-skia';
import { Image as Picture } from 'expo-image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, Easing, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withDecay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { Icon } from '../components/Icon';
import { PopIn, T } from '../components/ui';
import type { Topic } from '../config/levels';
import { capitalOf } from '../data/capitals';
import { FLAG_IMAGES } from '../data/flagImages';
import { AREA_LEAVE_OUT, areaOf, COUNTRIES, itemName, STATES } from '../data/gameData';
import { haptic } from '../feedback/haptics';
import { play } from '../feedback/sfx';
import { fmtArea } from '../i18n/strings';
import type { Item, Scene } from '../logic/types';
import { map as M, motion, radius, shadow, type, type MapTheme, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';
import { frameItem, WORLD_TOP, WRAP, type Box, type Cam } from './camera';
import { menuWorld, menuWorldPpu, prewarmWorld, renderView, retire, worldLayer, worldPpu, type Layer } from './raster';
import { itemPath, whenIdle } from './shapes';

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

const EMPTY = Skia.PathBuilder.Make().detach();
const PICK_FILL = 0.3;    // a tapped country is framed to this share of the map's window
const MAX_ZOOM_IN = 5;    // closest view: this many times closer than the home view
const MAX_ZOOM_OUT = 1.7; // widest view, never wider than the world
const SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.None };
const WORLD_SAMPLING = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear };
const GLIDE = { duration: 420, easing: Easing.out(Easing.cubic) };

type Props = {
  width: number; height: number; box: Box; scene: Scene; theme: MapTheme;
  home: Cam;                           // where the map rests: the current chapter's part of the world
  resetKey?: number;                   // change it to glide back home
  onMoved?: (moved: boolean) => void;  // the player has moved the map away from home (or it is back)
  safeTop: number;                     // the place card stays between these two lines (below the top bar,
  safeBottom: number;                  // above the stage card)
};

function ExploreMapImpl({ width, height, box, scene, theme, home, resetKey, onMoved, safeTop, safeBottom }: Props) {
  const st = useStyles(make_st);
  const { fx, fy, W } = box;
  const usa = scene === 'usa';
  // how far the map can go: any longitude on the world map (it wraps), the land's own height, the states on the US map
  const lim = useMemo(() => {
    const wMax = usa ? home.w * MAX_ZOOM_OUT : Math.min(WRAP, home.w * MAX_ZOOM_OUT);
    const wMin = Math.min(home.w / MAX_ZOOM_IN, usa ? 12 : 30); // close enough to frame a small country
    if (!usa) return { wMin, wMax, x0: -Infinity, x1: Infinity, y0: WORLD_TOP + 30, y1: 110 };
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of STATES) {
      x0 = Math.min(x0, s.bbox[0]); y0 = Math.min(y0, s.bbox[1]); x1 = Math.max(x1, s.bbox[2]); y1 = Math.max(y1, s.bbox[3]);
    }
    return { wMin, wMax, x0, x1, y0, y1 };
  }, [usa, home.w]);

  const ux = useSharedValue(home.ux);
  const uy = useSharedValue(home.uy);
  const w = useSharedValue(home.w);

  // ---- images
  // While the map moves it shows a whole-world image. Two of them, by zoom:
  // - `wide`: painted for the home zoom (lines as wide as the sharp view's), small and quick;
  // - `world`: the fine image the round uses too, for when the player has zoomed in.
  const pr = PixelRatio.get();
  // from far away only: when home is already close up (a small continent), the fine image is the better one
  const wantWide = (pr * W) / home.w < Math.min(worldPpu(scene) * 0.8, menuWorldPpu() * 2.2);
  const [wide, setWide] = useState<Layer | null>(null);
  const [world, setWorld] = useState<Layer | null>(null);
  const hasWorld = useSharedValue(0);
  const ensureWorld = useCallback(() => {
    const wd = wantWide ? menuWorld(scene, theme) : null;
    setWide(wd);
    // the fine image: finished now if the idle painting has not got there yet, unless the wide one will do for now
    const l = wd && hasWorld.value === 0 ? null : worldLayer(scene, 'all', theme);
    if (l) setWorld(l);
    hasWorld.value = wd || l ? 1 : 0;
  }, [scene, theme, wantWide, hasWorld]);
  useEffect(() => {
    let alive = true;
    setWorld(null);
    setWide(null);
    hasWorld.value = 0;
    whenIdle([() => alive && ensureWorld()]);
    prewarmWorld(scene, 'all', theme, () => alive && setWorld(worldLayer(scene, 'all', theme)));
    return () => {
      alive = false;
    };
  }, [scene, theme, ensureWorld, hasWorld]);

  const paint = useCallback((c: Cam) => renderView({ scene, topic: 'all', theme, cam: c, box, width, height }), [scene, theme, box, width, height]);
  // the first view is painted with the first render, so the menu never shows an empty sea
  const first = useMemo(() => paint(home), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<Layer | null>(first);
  const shown = useRef<Layer | null>(first);
  const sharp = useSharedValue(1); // 1: the sharp view is fully shown (at rest), 0: only the world image (moving)
  const show = useCallback((l: Layer | null) => {
    const old = shown.current;
    shown.current = l;
    setView(l);
    if (old && old !== l) retire(old);
  }, []);
  useEffect(() => () => retire(shown.current), []);
  useEffect(() => {
    if (view) sharp.value = withTiming(1, { duration: 200 });
  }, [view, sharp]);

  // the map has come to rest: paint what is on screen now
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const c = { ux: ux.value, uy: uy.value, w: w.value };
      show(paint(c));
      onMoved?.(Math.abs(c.ux - home.ux) > home.w * 0.04 || Math.abs(c.uy - home.uy) > home.w * 0.04 || Math.abs(c.w / home.w - 1) > 0.06);
    }, 80);
  }, [ux, uy, w, paint, show, onMoved, home]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const settled = (fin?: boolean) => {
    'worklet';
    if (fin !== false) runOnJS(settle)();
  };
  // a move begins: the sharp image steps back for the world image, which covers wherever the map goes
  const moveBegins = () => {
    'worklet';
    cancelAnimation(ux);
    cancelAnimation(uy);
    cancelAnimation(w);
    if (hasWorld.value) sharp.value = withTiming(0, { duration: 140 });
    else runOnJS(ensureWorld)();
  };
  const clampX = (x: number) => {
    'worklet';
    return Math.min(lim.x1, Math.max(lim.x0, x));
  };
  const clampY = (y: number) => {
    'worklet';
    return Math.min(lim.y1, Math.max(lim.y0, y));
  };
  const glideTo = (c: Cam) => {
    'worklet';
    moveBegins();
    // the short way round the world
    const x = usa ? c.ux : c.ux + Math.round((ux.value - c.ux) / WRAP) * WRAP;
    ux.value = withTiming(x, GLIDE);
    uy.value = withTiming(c.uy, GLIDE);
    w.value = withTiming(c.w, GLIDE, settled);
  };

  // home changed (another chapter), the theme changed, or the screen asked to go back: glide home and repaint
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPicked(null);
    glideTo(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [home, resetKey, paint]);

  // ---- a tapped place
  const [picked, setPicked] = useState<Item | null>(null);
  const pickedPath = useMemo(() => (picked ? itemPath(scene, picked.id) : null), [picked, scene]);
  const lift = useSharedValue(0);    // 0 flat on the map, 1 lifted out of it
  const pop = useSharedValue(1);     // the place's own scale: a quick bulge when it is tapped
  const ripple = useSharedValue(1);  // 0..1, a ring spreading from the finger
  const tapX = useSharedValue(0);
  const tapY = useSharedValue(0);
  const anchor = useSharedValue({ x: 0, y0: 0, y1: 0 }); // the place's middle, top and bottom on the map: the card hangs on it
  const pick = useCallback((mx: number, my: number) => {
    const reach = 14 * (w.value / W); // a finger is wider than Malta
    const all = usa ? STATES : COUNTRIES;
    const shifts = usa ? [0] : [0, WRAP, -WRAP];
    const x = usa ? mx : mx - Math.round(mx / WRAP) * WRAP;
    let hit: Item | null = null;
    // smallest first: a country inside another one (Lesotho, San Marino) wins over the one around it
    const inside = all.filter((it) => shifts.some((d) => x + d >= it.bbox[0] && x + d <= it.bbox[2] && my >= it.bbox[1] && my <= it.bbox[3]))
      .sort((a, b) => a.area_u - b.area_u);
    for (const it of inside) {
      if (shifts.some((d) => itemPath(scene, it.id)?.contains(x + d, my))) {
        hit = it;
        break;
      }
    }
    if (!hit) {
      // nothing under the finger: a small place right next to it?
      let best = reach;
      for (const it of all) {
        for (const d of shifts) {
          const dist = Math.hypot(it.label[0] - (x + d), it.label[1] - my);
          if (dist < best) {
            best = dist;
            hit = it;
          }
        }
      }
    }
    if (!hit || hit.id === picked?.id) {
      // the sea, or the same place again: put it back
      if (picked) {
        lift.value = withTiming(0, { duration: 160 });
        setPicked(null);
      }
      return;
    }
    setPicked(hit);
    play('pop');
    haptic.tap();
    anchor.value = { x: (hit.focus[0] + hit.focus[2]) / 2, y0: hit.focus[1], y1: hit.focus[3] };
    tapX.value = mx;
    tapY.value = my;
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.quad) });
    lift.value = 0;
    lift.value = withSpring(1, motion.spring);
    pop.value = withSequence(withTiming(1.1, { duration: 110 }), withSpring(1, motion.spring));
    // the camera goes to it: framed in the window, never closer or wider than the map allows
    const c = frameItem(hit, scene, box, PICK_FILL);
    glideTo({ ux: clampX(c.ux), uy: clampY(c.uy), w: Math.min(lim.wMax, Math.max(lim.wMin, c.w)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, usa, picked, box, lim, W]);

  // ---- gestures
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const tx0 = useSharedValue(0);
  const ty0 = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const rebase = useSharedValue(1);
  const pinching = useSharedValue(0);
  const w0 = useSharedValue(0);
  const mx = useSharedValue(0);
  const my = useSharedValue(0);

  const pan = usePanGesture({
    minPointers: 1,
    maxPointers: 2,
    onBegin: () => {
      rebase.value = 1;
    },
    onActivate: () => {
      moveBegins();
      rebase.value = 1;
    },
    onUpdate: (e) => {
      if (pinching.value) return; // two fingers: the pinch moves the map, around the fingers
      if (rebase.value) {
        rebase.value = 0;
        x0.value = ux.value;
        y0.value = uy.value;
        tx0.value = e.translationX;
        ty0.value = e.translationY;
      }
      const u = w.value / W;
      ux.value = clampX(x0.value - (e.translationX - tx0.value) * u);
      uy.value = clampY(y0.value - (e.translationY - ty0.value) * u);
      vx.value = -e.velocityX * u;
      vy.value = -e.velocityY * u;
    },
    onDeactivate: () => {
      if (pinching.value) return;
      // let go: the map keeps gliding and slows down
      const fast = Math.abs(vx.value) + Math.abs(vy.value) > 20 * (w.value / W);
      if (!fast) return settled();
      ux.value = withDecay({ velocity: vx.value, deceleration: 0.994, clamp: usa ? [lim.x0, lim.x1] : undefined }, settled);
      uy.value = withDecay({ velocity: vy.value, deceleration: 0.994, clamp: [lim.y0, lim.y1] });
    },
  });

  const pinch = usePinchGesture({
    onActivate: (e) => {
      moveBegins();
      pinching.value = 1;
      w0.value = w.value;
      const u = w.value / W;
      mx.value = ux.value + (e.focalX - fx) * u;
      my.value = uy.value + (e.focalY - fy) * u;
    },
    onUpdate: (e) => {
      // zoom around the fingers: the point of the map under them stays under them
      const nw = Math.min(lim.wMax, Math.max(lim.wMin, w0.value / Math.max(e.scale, 0.01)));
      const u = nw / W;
      w.value = nw;
      ux.value = clampX(mx.value - (e.focalX - fx) * u);
      uy.value = clampY(my.value - (e.focalY - fy) * u);
    },
    onDeactivate: () => {
      pinching.value = 0;
      rebase.value = 1;
      settled();
    },
  });

  const tap = useTapGesture({
    onDeactivate: (e) => {
      if (e.canceled) return;
      const u = w.value / W;
      runOnJS(pick)(ux.value + (e.x - fx) * u, uy.value + (e.y - fy) * u);
    },
  });
  const gesture = useSimultaneousGestures(pinch, pan, tap);

  // tell the screen as soon as the map leaves home (the "back" button appears while the finger is still down)
  useAnimatedReaction(
    () => Math.abs(ux.value - home.ux) > home.w * 0.04 || Math.abs(uy.value - home.uy) > home.w * 0.04 || Math.abs(w.value / home.w - 1) > 0.06,
    (now, before) => {
      if (now !== before && onMoved) runOnJS(onMoved)(now);
    },
  );

  // ---- drawing
  const camT = useDerivedValue(() => {
    const s = W / w.value;
    return [{ translateX: fx - ux.value * s }, { translateY: fy - uy.value * s }, { scale: s }];
  });
  const shiftT = useDerivedValue(() => [{ translateX: usa ? 0 : Math.round(ux.value / WRAP) * WRAP }]);
  const seaA = useDerivedValue(() => ({ x: 0, y: uy.value - (fy * w.value) / W }));
  const seaB = useDerivedValue(() => ({ x: 0, y: uy.value + ((height - fy) * w.value) / W }));
  // hidden under the sharp view at rest; while moving, the wide image until the player has zoomed in past it
  const wideLimit = wide ? wide.ppu * 1.6 : 0;
  const haveFine = !!world;
  const useWide = useDerivedValue(() => (wideLimit > 0 && ((pr * W) / w.value <= wideLimit || !haveFine) ? 1 : 0));
  const wideOpacity = useDerivedValue(() => (sharp.value >= 1 ? 0 : useWide.value));
  const worldOpacity = useDerivedValue(() => (sharp.value >= 1 ? 0 : 1 - useWide.value));
  const seaOpacity = useDerivedValue(() => (sharp.value >= 1 ? 1 : 0));
  const sea = useMemo(() => [theme.seaTop, theme.seaBottom], [theme]);
  // the tapped place: its outline in the target colour, lifted (a shadow under it), on the copy of the world the
  // camera is over
  const unit = useDerivedValue(() => w.value / W);
  const pickT = useDerivedValue(() => [{ translateX: usa ? 0 : Math.round((ux.value - anchor.value.x) / WRAP) * WRAP }]);
  const pickP = useDerivedValue(() => (pickedPath && lift.value > 0.01 ? pickedPath : EMPTY));
  const popT = useDerivedValue(() => [{ scale: pop.value }]);
  const popOrigin = useDerivedValue(() => ({ x: anchor.value.x, y: (anchor.value.y0 + anchor.value.y1) / 2 }));
  const shadowT = useDerivedValue(() => [{ translateY: (M.shadowOffset + 3) * lift.value * unit.value }]);
  const edgeW = useDerivedValue(() => M.targetEdge * unit.value);
  const rippleR = useDerivedValue(() => (8 + 70 * ripple.value) * unit.value);
  const rippleW = useDerivedValue(() => 3 * (1 - ripple.value) * unit.value);
  const rippleO = useDerivedValue(() => (ripple.value >= 1 ? 0 : 1 - ripple.value));
  // the card: above the place, below it when there is no room, always inside the map's window
  const cardW = useSharedValue(0);
  const cardH = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => {
    const s = W / w.value;
    const a = anchor.value;
    const k = usa ? 0 : Math.round((ux.value - a.x) / WRAP) * WRAP;
    const x = Math.min(width - 10 - cardW.value, Math.max(10, fx + (a.x + k - ux.value) * s - cardW.value / 2));
    let y = fy + (a.y0 - uy.value) * s - cardH.value - 12;
    if (y < safeTop) y = fy + (a.y1 - uy.value) * s + 12;
    y = Math.max(safeTop, Math.min(safeBottom - cardH.value, y));
    return { opacity: cardW.value > 0 ? 1 : 0, transform: [{ translateX: x }, { translateY: y }] };
  });
  const copies = usa ? [0] : [-WRAP, 0, WRAP];
  const style = { position: 'absolute' as const, left: 0, top: 0, width, height };

  return (
    <>
      <Canvas style={style} pointerEvents="none">
        {/* Two dots under the sea, never seen. Drawing an image for the first time sends it to the GPU (tens of
            megabytes for the world image): that happens here, on the idle menu, not in the first frame of a drag
            or of a round. */}
        {wide ? <Image image={wide.image} x={0} y={0} width={2} height={2} fit="fill" sampling={SAMPLING} /> : null}
        {world ? <Image image={world.image} x={2} y={0} width={2} height={2} fit="fill" sampling={WORLD_SAMPLING} /> : null}
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient start={vec(0, 0)} end={vec(0, height)} colors={sea} />
        </Rect>
        <Group transform={camT}>
          {wide ? (
            <Group transform={shiftT} opacity={wideOpacity}>
              {copies.map((dx) => (
                <Image key={dx} image={wide.image} x={wide.x + dx} y={wide.y} width={wide.w} height={wide.h} fit="fill" sampling={SAMPLING} />
              ))}
            </Group>
          ) : null}
          {world ? (
            <Group transform={shiftT} opacity={worldOpacity}>
              {copies.map((dx) => (
                <Image key={dx} image={world.image} x={world.x + dx} y={world.y} width={world.w} height={world.h} fit="fill" sampling={WORLD_SAMPLING} />
              ))}
            </Group>
          ) : null}
          {view ? (
            <>
              <Rect x={view.x} y={view.y} width={view.w} height={view.h} opacity={seaOpacity}>
                <LinearGradient start={seaA} end={seaB} colors={sea} />
              </Rect>
              <Image image={view.image} x={view.x} y={view.y} width={view.w} height={view.h} fit="fill" sampling={SAMPLING} opacity={sharp} />
            </>
          ) : null}
          <Group transform={pickT}>
            <Group origin={popOrigin} transform={popT}>
              <Group transform={shadowT}><Path path={pickP} color={theme.targetEdge} opacity={0.45} /></Group>
              <Path path={pickP} color={theme.target} />
              <Path path={pickP} color={theme.targetEdge} style="stroke" strokeWidth={edgeW} />
            </Group>
          </Group>
          <Circle cx={tapX} cy={tapY} r={rippleR} color={theme.target} style="stroke" strokeWidth={rippleW} opacity={rippleO} />
        </Group>
      </Canvas>
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill} testID="home-map" />
      </GestureDetector>
      {picked ? (
        <Animated.View style={[st.cardWrap, cardStyle]} pointerEvents="none"
          onLayout={(e) => {
            cardW.value = e.nativeEvent.layout.width;
            cardH.value = e.nativeEvent.layout.height;
          }}>
          <PlaceCard key={picked.id} item={picked} />
        </Animated.View>
      ) : null}
    </>
  );
}

/** What a tapped place is: its flag, its name, its capital and how big it is. Icons, not sentences. */
function PlaceCard({ item }: { item: Item }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const flag = FLAG_IMAGES[item.id];
  const capital = capitalOf(item.id);
  const area = AREA_LEAVE_OUT.has(item.id) ? 0 : areaOf(item);
  return (
    <PopIn from={0.5}>
      <View style={[st.card, shadow.card]} testID="place-card">
        {flag ? <Picture source={flag} style={st.flag} contentFit="cover" /> : <View style={[st.flag, st.noFlag]}><Icon name="map-marker" size={26} color={colors.accent} /></View>}
        <View style={st.facts}>
          <T size={type.heading} weight="black" lines={2}>{itemName(item.id)}</T>
          {capital ? <View style={st.fact}><Icon name="star-circle" size={15} color={colors.gold} /><T size={type.label} weight="bold" color={colors.inkSoft} lines={1}>{capital}</T></View> : null}
          {area > 0 ? <View style={st.fact}><Icon name="ruler-square" size={15} color={colors.accent} /><T size={type.label} weight="bold" color={colors.inkSoft} lines={1}>{fmtArea(area)}</T></View> : null}
        </View>
      </View>
    </PopIn>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  cardWrap: { position: 'absolute', left: 0, top: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 10, paddingRight: 16, maxWidth: 280 },
  flag: { width: 68, height: 50, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.track },
  noFlag: { backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  facts: { gap: 2, flexShrink: 1 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});

export const ExploreMap = React.memo(ExploreMapImpl);
