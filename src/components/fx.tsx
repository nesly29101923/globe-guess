// Screen-wide effects: coins that fly to the counter, XP sparks, confetti. One layer at the root.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { playCoin } from '../feedback/sfx';
import { colors } from '../theme';

type Pt = { x: number; y: number };
type Burst =
  | { id: number; kind: 'coins'; from: Pt; to: Pt; n: number; icon: string; onLand?: () => void; onDone?: () => void }
  | { id: number; kind: 'confetti'; big: boolean };

let push: ((b: Burst) => void) | null = null;
let seq = 1;
const targets: Record<string, Pt> = {};

export const fx = {
  setTarget(name: 'coins' | 'xp', p: Pt) {
    targets[name] = p;
  },
  target(name: 'coins' | 'xp'): Pt {
    return targets[name] ?? { x: 60, y: 60 };
  },
  coins(from: Pt, n: number, opts: { to?: 'coins' | 'xp'; onLand?: () => void; onDone?: () => void } = {}) {
    const to = fx.target(opts.to ?? 'coins');
    push?.({ id: seq++, kind: 'coins', from, to, n: Math.max(1, Math.min(12, n)), icon: opts.to === 'xp' ? '✦' : '●', onLand: opts.onLand, onDone: opts.onDone });
  },
  confetti(big = false) {
    push?.({ id: seq++, kind: 'confetti', big });
  },
};

export function FxLayer() {
  const [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    push = (b) => setBursts((x) => [...x, b]);
    return () => {
      push = null;
    };
  }, []);
  const remove = (id: number) => setBursts((x) => x.filter((b) => b.id !== id));
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {bursts.map((b) =>
        b.kind === 'coins' ? (
          <CoinBurst key={b.id} b={b} onEnd={() => remove(b.id)} />
        ) : (
          <Confetti key={b.id} big={b.big} onEnd={() => remove(b.id)} />
        ),
      )}
    </View>
  );
}

function CoinBurst({ b, onEnd }: { b: Extract<Burst, { kind: 'coins' }>; onEnd: () => void }) {
  const landed = useRef(0);
  const land = useRef(() => {
    landed.current += 1;
    playCoin();
    b.onLand?.();
    if (landed.current >= b.n) {
      b.onDone?.();
      onEnd();
    }
  }).current;
  return (
    <>
      {Array.from({ length: b.n }, (_, i) => (
        <FlyingCoin key={i} i={i} from={b.from} to={b.to} icon={b.icon} onLand={land} />
      ))}
    </>
  );
}

function FlyingCoin({ i, from, to, icon, onLand }: { i: number; from: Pt; to: Pt; icon: string; onLand: () => void }) {
  const t = useSharedValue(0);
  const spreadX = (Math.sin(i * 2.3) * 40) | 0;
  const spreadY = (Math.cos(i * 1.7) * 30) | 0;
  useEffect(() => {
    t.value = withDelay(i * 55, withTiming(1, { duration: 620, easing: Easing.in(Easing.quad) }, (fin) => {
      if (fin) runOnJS(onLand)();
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const a = useAnimatedStyle(() => {
    const k = t.value;
    // burst out a little, then curve to the counter
    const out = Math.min(1, k * 4);
    const sx = from.x + spreadX * out;
    const sy = from.y + spreadY * out;
    const x = sx + (to.x - sx) * k;
    const y = sy + (to.y - sy) * k - Math.sin(k * Math.PI) * 60;
    return { opacity: k < 0.98 ? 1 : 0, transform: [{ translateX: x - 11 }, { translateY: y - 11 }, { scale: 1 - 0.35 * k }] };
  });
  return (
    <Animated.View style={[st.coin, icon === '✦' && st.xp, a]}>
      <Text style={st.coinText}>{icon === '✦' ? '✦' : ''}</Text>
    </Animated.View>
  );
}

const CONFETTI_COLORS = [colors.accent, colors.correct, colors.gold, '#0EA5E9', '#EC4899', '#F97316'];

function Confetti({ big, onEnd }: { big: boolean; onEnd: () => void }) {
  const { width, height } = useWindowDimensions();
  const n = big ? 60 : 32;
  const end = useRef(onEnd).current;
  useEffect(() => {
    const h = setTimeout(end, 2600);
    return () => clearTimeout(h);
  }, [end]);
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <Piece key={i} i={i} W={width} H={height} />
      ))}
    </>
  );
}

function Piece({ i, W, H }: { i: number; W: number; H: number }) {
  const t = useSharedValue(0);
  const x0 = W / 2 + Math.sin(i * 12.9898) * W * 0.15;
  const vx = Math.sin(i * 78.233) * W * 0.55;
  const vy = -(H * 0.35 + ((i * 37) % 100) * 3);
  const rot = (i * 47) % 360;
  const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
  useEffect(() => {
    t.value = withDelay((i % 6) * 30, withTiming(1, { duration: 2200 + (i % 5) * 80, easing: Easing.linear }));
  }, [i, t]);
  const a = useAnimatedStyle(() => {
    const k = t.value;
    const x = x0 + vx * k;
    const y = H * 0.42 + vy * k + 1.1 * H * k * k;
    return { opacity: k < 0.85 ? 1 : (1 - k) / 0.15, transform: [{ translateX: x }, { translateY: y }, { rotate: `${rot + k * 720}deg` }] };
  });
  return <Animated.View style={[st.piece, { backgroundColor: color, width: 7 + (i % 3) * 3, height: 10 + (i % 4) * 3 }, a]} />;
}

const st = StyleSheet.create({
  coin: { position: 'absolute', left: 0, top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FCD34D', alignItems: 'center', justifyContent: 'center' },
  xp: { backgroundColor: colors.accent, borderColor: '#C4B5FD' },
  coinText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  piece: { position: 'absolute', left: 0, top: 0, borderRadius: 2 },
});
