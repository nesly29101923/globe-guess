// Counters that never jump: coins roll up and bump when coins land; the level badge with its XP bar.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { play } from '../feedback/sfx';
import { fmt, t } from '../i18n/strings';
import { colors, motion, radius, shadow } from '../theme';
import { fx } from './fx';
import { Dot, Press, ProgressBar, T } from './ui';

/** A number that counts to its value instead of jumping. */
export function useCountUp(target: number, ms: number = motion.countUp, sound = false): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    if (a === target) return;
    let last = 0;
    let raf: ReturnType<typeof setTimeout>;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = Math.round(a + (target - a) * e);
      setV(cur);
      if (sound && Date.now() - last > 60 && k < 1) {
        last = Date.now();
        play('count');
      }
      if (k < 1) raf = setTimeout(step, 16);
      else from.current = target;
    };
    step();
    return () => clearTimeout(raf);
  }, [target, ms, sound]);
  return v;
}

export function CountUp({ value, size = 40, color = colors.ink, ms, sound, weight = 'black' }: {
  value: number; size?: number; color?: string; ms?: number; sound?: boolean; weight?: 'black' | 'bold' | 'xbold';
}) {
  const v = useCountUp(value, ms, sound);
  return <T size={size} weight={weight} color={color}>{fmt(v)}</T>;
}

/** Coin pill. Registers itself as the target for flying coins. */
export function CoinPill({ value, onPress, bumpKey, testID }: { value: number; onPress?: () => void; bumpKey?: number; testID?: string }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const s = useSharedValue(1);
  const shown = useCountUp(value, 500);
  useEffect(() => {
    if (bumpKey) s.value = withSequence(withTiming(1.18, { duration: 70 }), withSpring(1, motion.spring));
  }, [bumpKey, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  const onLayout = (_e: LayoutChangeEvent) => {
    ref.current?.measureInWindow((x, y, w, h) => fx.setTarget('coins', { x: x + 16, y: y + h / 2 }));
  };
  return (
    <Press onPress={onPress} disabled={!onPress} testID={testID}>
      <Animated.View ref={ref} onLayout={onLayout} style={[st.pill, shadow.soft, a]}>
        <View style={st.coin} />
        <T size={16} weight="black">{fmt(shown, true)}</T>
        {onPress ? <View style={st.plus}><T size={13} weight="black" color={colors.white}>+</T></View> : null}
      </Animated.View>
    </Press>
  );
}

export function LevelBadge({ level, xp, need, onPress, compact }: { level: number; xp: number; need: number; onPress?: () => void; compact?: boolean }) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const onLayout = () => ref.current?.measureInWindow((x, y, w, h) => fx.setTarget('xp', { x: x + 18, y: y + h / 2 }));
  return (
    <Press onPress={onPress} disabled={!onPress}>
      <View ref={ref} onLayout={onLayout} style={[st.level, shadow.soft]}>
        <View style={st.lvCircle}><T size={15} weight="black" color={colors.white}>{String(level)}</T></View>
        {!compact ? (
          <View style={{ width: 70, gap: 2 }}>
            <T size={10} weight="bold" color={colors.inkSoft}>{`${t('lvl')} ${level}`}</T>
            <ProgressBar value={need ? xp / need : 1} height={7} />
          </View>
        ) : null}
      </View>
    </Press>
  );
}

export function HeartsPill({ count, max, nextIn, onPress }: { count: number; max: number; nextIn: string | null; onPress?: () => void }) {
  return (
    <Press onPress={onPress} disabled={!onPress}>
      <View style={[st.pill, shadow.soft]}>
        <T size={15}>❤️</T>
        <T size={16} weight="black">{String(count)}</T>
        {count < max && nextIn ? <T size={10} weight="bold" color={colors.inkSoft}>{nextIn}</T> : null}
      </View>
    </Press>
  );
}

export function IconButton({ icon, onPress, dot, testID, label }: { icon: string; onPress: () => void; dot?: boolean; testID?: string; label?: string }) {
  return (
    <Press onPress={onPress} testID={testID}>
      <View style={[st.icon, shadow.soft]}>
        <T size={20}>{icon}</T>
        {label ? <T size={9} weight="bold" color={colors.inkSoft}>{label}</T> : null}
        {dot ? <Dot /> : null}
      </View>
    </Press>
  );
}

const st = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, height: 40 },
  coin: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FCD34D' },
  plus: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.correct, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.white, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 12, height: 40 },
  lvCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
