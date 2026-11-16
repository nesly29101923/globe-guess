// Counters that never jump: coins roll up and bump when coins land; the level badge with its XP bar.
import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { play } from '../feedback/sfx';
import { fmt, t } from '../i18n/strings';
import { motion, radius, shadow, sizes, type, type Palette } from '../theme';
import { fx } from './fx';
import { Coin, Icon, type IconName } from './Icon';
import { Dot, Press, ProgressBar, T } from './ui';
import { usePalette, useStyles } from '../theme/usePalette';

/** A number that counts to its value instead of jumping. */
export function useCountUp(target: number, ms: number = motion.countUp, sound = false): number {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    if (a === target) return;
    let last = 0;
    let raf = 0;
    let lastSet = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      const cur = Math.round(a + (target - a) * e);
      // about 30 updates a second is smooth for a number and halves the React work of a count-up
      if (k >= 1 || Date.now() - lastSet >= 32) {
        lastSet = Date.now();
        setV(cur);
      }
      if (sound && Date.now() - last > 120 && k < 1) {
        last = Date.now();
        play('count');
      }
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = target;
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [target, ms, sound]);
  return v;
}

export function CountUp({ value, size = 40, color, ms, sound, weight = 'black' }: {
  value: number; size?: number; color?: string; ms?: number; sound?: boolean; weight?: 'black' | 'bold' | 'xbold';
}) {
  const v = useCountUp(value, ms, sound);
  return <T size={size} weight={weight} color={color}>{fmt(v)}</T>;
}

/** Coin pill. Registers itself as the target for flying coins. */
export function CoinPill({ value, onPress, bumpKey, testID }: { value: number; onPress?: () => void; bumpKey?: number; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
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
      <Animated.View ref={ref} onLayout={onLayout} style={[st.pill, onPress ? st.pillWithPlus : null, shadow.soft, a]}>
        <Coin size={26} />
        <T size={type.heading} weight="black" style={st.num}>{fmt(shown, true)}</T>
        {onPress ? <View style={st.plus}><Icon name="plus-thick" size={16} color={colors.white} /></View> : null}
      </Animated.View>
    </Press>
  );
}

export function LevelBadge({ level, xp, need, onPress, compact, testID }: { level: number; xp: number; need: number; onPress?: () => void; compact?: boolean; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const onLayout = () => ref.current?.measureInWindow((x, y, w, h) => fx.setTarget('xp', { x: x + 18, y: y + h / 2 }));
  return (
    <Press onPress={onPress} disabled={!onPress} testID={testID}>
      <View ref={ref} onLayout={onLayout} style={[st.level, compact && st.levelCompact, shadow.soft]}>
        <View style={st.lvCircle}><T size={type.body} weight="black" color={colors.white}>{String(level)}</T></View>
        {!compact ? (
          <View style={st.lvRight}>
            <T size={type.caption} weight="bold" color={colors.inkSoft} lines={1}>{need ? `${fmt(xp)}/${fmt(need)} ${t('xp')}` : t('level')}</T>
            <ProgressBar value={need ? xp / need : 1} height={6} />
          </View>
        ) : null}
      </View>
    </Press>
  );
}

export function HeartsPill({ count, max, nextIn, onPress }: { count: number; max: number; nextIn: string | null; onPress?: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} disabled={!onPress}>
      <View style={[st.pill, shadow.soft]}>
        <Icon name="heart" size={22} color={colors.heart} />
        <T size={type.heading} weight="black" style={st.num}>{String(count)}</T>
        {count < max && nextIn ? <T size={type.caption} weight="bold" color={colors.inkSoft}>{nextIn}</T> : null}
      </View>
    </Press>
  );
}

/** Square icon button, the same height as the pills next to it. */
export function IconButton({ icon, onPress, dot, testID }: { icon: IconName; onPress: () => void; dot?: boolean; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID}>
      <View style={[st.icon, shadow.soft]}>
        <Icon name={icon} size={24} color={colors.ink} />
        {dot ? <Dot /> : null}
      </View>
    </Press>
  );
}

/** A small pill with an icon and a number (stars, streak). Same height as the other HUD pills. */
export function StatPill({ icon, color, value, onPress, testID }: { icon: IconName; color: string; value: string; onPress?: () => void; testID?: string }) {
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} disabled={!onPress} testID={testID}>
      <View style={[st.pill, shadow.soft]}>
        <Icon name={icon} size={22} color={color} />
        <T size={type.heading} weight="black" style={st.num}>{value}</T>
      </View>
    </Press>
  );
}

// Every HUD element is sizes.hud tall; inner circles are hud - 8, so the left/top/bottom insets match.
const H = sizes.hud;
const make_st = (colors: Palette) => StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingLeft: 9, paddingRight: 14, height: H },
  pillWithPlus: { paddingRight: 4 },
  num: { minWidth: 18, textAlign: 'left' },
  plus: { width: H - 8, height: H - 8, borderRadius: (H - 8) / 2, backgroundColor: colors.correct, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  level: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingLeft: 4, paddingRight: 14, height: H },
  levelCompact: { paddingRight: 4 },
  lvCircle: { width: H - 8, height: H - 8, borderRadius: (H - 8) / 2, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  lvRight: { width: 76, gap: 3 },
  icon: { width: H, height: H, borderRadius: radius.md, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});

/** The top bar of every screen: back button, title, and up to two HUD items on the right. All sizes.hud tall. */
export function ScreenHeader({ title, onBack, right, testID }: { title?: string; onBack: () => void; right?: React.ReactNode; testID?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: sizes.hud }}>
      <IconButton icon="arrow-left" onPress={onBack} testID={testID} />
      <View style={{ flex: 1 }}>{title ? <T size={type.title} weight="black" lines={1} shrink>{title}</T> : null}</View>
      {right}
    </View>
  );
}
