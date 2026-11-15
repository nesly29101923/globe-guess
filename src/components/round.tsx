// The pieces of a question, drawn like the videos: title card with chips, progress dots, timer ring,
// 2x2 answer buttons with letter badges, combo badge, answer pill, flag card.
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, interpolateColor, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withRepeat, withSequence,
  withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { BUTTON_STYLES } from '../config/cosmetics';
import { FLAG_IMAGES } from '../data/flagImages';
import { t, upper } from '../i18n/strings';
import { colors, fonts, motion, radius, shadow, tierColors, type Palette } from '../theme';
import { fitSize, Press, T } from './ui';
import { usePalette, useStyles } from '../theme/usePalette';

// ---------------------------------------------------------------- title card

export function TitleCard({ title, chips, tier, style }: { title: string; chips: string[]; tier?: string; style?: StyleProp<ViewStyle> }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withSpring(1, motion.springSoft);
  }, [title, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * -24 }] }));
  const f = fitSize(title, 24, 330, 16, 0.66);
  return (
    <Animated.View style={[st.title, shadow.card, style, a]}>
      <T size={f.size} weight="black" center lines={1} shrink>{title}</T>
      <View style={st.chips}>
        {chips.map((c) => (
          <View key={c} style={[st.chip, { backgroundColor: colors.chip }]}>
            <T size={11} weight="bold">{c}</T>
          </View>
        ))}
        {tier ? (
          <View style={[st.chip, { backgroundColor: tierColors[tier] ?? colors.accent }]}>
            <T size={11} weight="bold" color={colors.white}>{upper(t(`tier_${tier}` as never))}</T>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- progress dots

export function ProgressDots({ total, index, results }: { total: number; index: number; results: (boolean | null)[] }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <View style={st.dotsWrap}>
      <View style={st.dots}>
        {Array.from({ length: total }, (_, i) => {
          const r = results[i];
          const bg = r === true ? colors.correct : r === false ? colors.wrong : i === index ? colors.accent : colors.progressTodo;
          return <Dot key={i} bg={bg} current={i === index} edge={r == null && i !== index} />;
        })}
      </View>
      <T size={11} weight="bold" color="rgba(15,23,42,0.67)">{`${Math.min(index + 1, total)}/${total}`}</T>
    </View>
  );
}

function Dot({ bg, current, edge }: { bg: string; current: boolean; edge: boolean }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = withSequence(withTiming(1.35, { duration: 120 }), withSpring(current ? 1.15 : 1, motion.spring));
  }, [bg, current, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={[st.dot, { backgroundColor: bg, borderWidth: edge ? 1.5 : 0, borderColor: colors.progressTodoEdge }, a]} />;
}

// ---------------------------------------------------------------- timer ring

export function TimerRing({ progress, secondsLeft, size = 76, frozen }: { progress: SharedValue<number>; secondsLeft: number; size?: number; frozen?: boolean }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const stroke = 8;
  const r = size / 2 - stroke / 2 - 4;
  const path = useMemo(() => {
    const b = Skia.PathBuilder.Make();
    b.addArc({ x: size / 2 - r, y: size / 2 - r, width: r * 2, height: r * 2 }, -90, 359.9);
    return b.detach();
  }, [size, r]);
  const color = useDerivedValue(() => {
    const p = progress.value; // 1 -> 0
    return interpolateColor(p, [0, 0.3, 0.5, 1], [colors.timer[2], colors.timer[2], colors.timer[1], colors.timer[0]]);
  });
  const bump = useSharedValue(1);
  useEffect(() => {
    bump.value = withSequence(withTiming(1.22, { duration: 70 }), withSpring(1, motion.spring));
  }, [secondsLeft, bump]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: bump.value }] }));
  const urgent = secondsLeft <= 3 && !frozen;
  return (
    <View style={[{ width: size, height: size }, shadow.card, st.timerDisc]}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={size / 2} cy={size / 2} r={r} color={colors.track} style="stroke" strokeWidth={stroke} />
        <Path path={path} color={frozen ? '#38BDF8' : color} style="stroke" strokeWidth={stroke} strokeCap="round" end={progress} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, st.center, a]}>
        <T size={frozen ? 24 : 30} weight="black" color={urgent ? colors.wrong : colors.ink}>{frozen ? '❄' : String(Math.max(0, secondsLeft))}</T>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- answer button

export type ButtonState = 'idle' | 'correct' | 'wrong' | 'faded' | 'removed';

export function AnswerButton({
  letter, label, flagId, state, onPress, index, disabled, skin = 'btn_classic', revealKey, testID, width = 140,
}: {
  letter: string; label: string; flagId?: string; state: ButtonState; onPress: () => void; index: number; disabled: boolean;
  skin?: string; revealKey: string; testID?: string; width?: number;
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const sk = BUTTON_STYLES[skin] ?? BUTTON_STYLES.btn_classic;
  const pop = useSharedValue(0);
  const shake = useSharedValue(0);
  const blink = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    pop.value = 0;
    // buttons pop in when the camera has arrived (revealKey ends with "-fly" while it moves)
    if (!revealKey.endsWith('-fly')) pop.value = withDelay(index * 60, withSpring(1, motion.spring));
    blink.value = 0;
    fade.value = 1;
    shake.value = 0;
  }, [revealKey, index, pop, blink, fade, shake]);
  useEffect(() => {
    if (state === 'correct') {
      const n = Math.round((motion.blinkMs / 1000) * motion.blinkHz);
      const half = 1000 / motion.blinkHz / 2;
      blink.value = withSequence(
        ...Array.from({ length: n }, () => withSequence(withTiming(1, { duration: half * 0.35 }), withTiming(0.45, { duration: half * 0.65 }))),
        withTiming(1, { duration: 120 }),
      );
      pop.value = withSequence(withTiming(1.08, { duration: 90 }), withSpring(1, motion.spring));
    } else if (state === 'wrong') {
      shake.value = withSequence(...[1, -1, 0.8, -0.8, 0.5, -0.5, 0].map((x) => withTiming(x, { duration: 45 })));
      fade.value = withDelay(500, withTiming(0.75, { duration: 300 }));
    } else if (state === 'faded') {
      fade.value = withTiming(motion.wrongAlpha, { duration: 250 });
    } else if (state === 'removed') {
      fade.value = withTiming(0.12, { duration: 250 });
    }
  }, [state, blink, shake, fade, pop]);
  const a = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 1.5) * fade.value,
    transform: [{ scale: 0.7 + 0.3 * pop.value }, { translateX: shake.value * 9 }],
  }));
  const bgA = useAnimatedStyle(() => ({
    backgroundColor: state === 'wrong' ? colors.wrong : interpolateColor(blink.value, [0, 1], [sk.bg, colors.correct]),
  }));
  const isWrong = state === 'wrong';
  const isRight = state === 'correct';
  const textColor = isWrong || isRight ? colors.white : sk.text;
  const f = fitSize(upper(label), 15, width - 26 - 16 - 24, 10, 0.78);
  return (
    <Animated.View style={[st.answerWrap, a]}>
      <Press onPress={onPress} disabled={disabled || state === 'removed'} sound={null} scaleTo={0.94} testID={testID}>
        <Animated.View style={[st.answer, shadow.card, sk.border ? { borderWidth: 2, borderColor: sk.border } : null, bgA]}>
          <View style={[st.letter, { backgroundColor: isRight || isWrong ? 'rgba(255,255,255,0.25)' : sk.badgeBg }]}>
            <T size={13} weight="black" color={isRight || isWrong ? colors.white : sk.badgeText}>{letter}</T>
          </View>
          {flagId ? (
            <View style={st.flagSlot}>
              <Image source={FLAG_IMAGES[flagId]} style={st.flagSmall} contentFit="contain" />
            </View>
          ) : (
            <View style={st.answerTextBox}>
              <T size={f.size} weight="bold" color={textColor} lines={f.lines} center shrink>{upper(label)}</T>
            </View>
          )}
          {isRight ? <T size={16} color={colors.white}>✓</T> : isWrong ? <T size={16} color={colors.white}>✕</T> : <View style={{ width: 4 }} />}
        </Animated.View>
      </Press>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- combo

export function ComboBadge({ combo }: { combo: number }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const s = useSharedValue(0);
  const flame = useSharedValue(0);
  useEffect(() => {
    if (combo >= 2) s.value = withSequence(withTiming(1.45, { duration: 110 }), withSpring(1, motion.spring));
    else s.value = withTiming(0, { duration: 180 });
    flame.value = combo >= 5 ? withRepeat(withSequence(withTiming(1, { duration: 260 }), withTiming(0.6, { duration: 260 })), -1) : withTiming(0);
  }, [combo, s, flame]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, s.value), transform: [{ scale: s.value }, { rotate: `${-6 + 3 * flame.value}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.25 + 0.5 * flame.value, transform: [{ scale: 1 + 0.25 * flame.value }] }));
  const hot = combo >= 3;
  const bg = combo >= 5 ? colors.flame : combo >= 3 ? colors.gold : colors.accent;
  return (
    <Animated.View style={[st.combo, a]} pointerEvents="none">
      {hot ? <Animated.View style={[st.comboGlow, { backgroundColor: bg }, glow]} /> : null}
      <View style={[st.comboPill, { backgroundColor: bg }, shadow.card]}>
        <T size={11} weight="bold" color={colors.white}>{combo >= 5 ? '🔥 ' : ''}{t('combo')}</T>
        <T size={combo >= 5 ? 26 : combo >= 3 ? 23 : 20} weight="black" color={colors.white}>{`x${Math.min(combo, 5)}`}</T>
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- answer pill (name on reveal)

export function AnswerPill(props: { name: string; correct: boolean; flagId?: string; visible: boolean }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  // keep showing the last revealed answer while fading out, so the next question's answer never flashes up
  const shown = React.useRef(props);
  if (props.visible) shown.current = props;
  const { name, correct, flagId } = shown.current;
  const visible = props.visible;
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = visible ? withSpring(1, motion.spring) : withTiming(0, { duration: motion.exit });
  }, [visible, v, name]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.6 + 0.4 * v.value }, { translateY: (1 - v.value) * 12 }] }));
  const f = fitSize(upper(name), 22, 260, 13, 0.66);
  return (
    <Animated.View style={[st.pill, shadow.card, a]} pointerEvents="none">
      {flagId && FLAG_IMAGES[flagId] ? <Image source={FLAG_IMAGES[flagId]} style={st.pillFlag} contentFit="cover" /> : (
        <View style={[st.pillIcon, { backgroundColor: correct ? colors.correct : colors.wrong }]}>
          <T size={14} weight="black" color={colors.white}>{correct ? '✓' : '!'}</T>
        </View>
      )}
      <T size={f.size} weight="black" lines={f.lines} shrink>{upper(name)}</T>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- flag card

export function FlagCard({ flagId, small, width }: { flagId: string; small: SharedValue<number>; width: number }) {
  const st = useStyles(make_st);
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withSpring(1, motion.springSoft);
  }, [flagId, v]);
  const a = useAnimatedStyle(() => {
    const k = small.value;
    return {
      opacity: Math.min(1, v.value * 1.4),
      transform: [{ translateY: -k * width * 0.42 }, { scale: (0.7 + 0.3 * v.value) * (1 - 0.55 * k) }],
    };
  });
  return (
    <Animated.View style={[st.flagCard, shadow.card, { width, padding: width * 0.035 }, a]} pointerEvents="none">
      <Image source={FLAG_IMAGES[flagId]} style={{ width: width * 0.93, height: width * 0.93 * 0.75, borderRadius: 10 }} contentFit="contain" />
    </Animated.View>
  );
}

// ---------------------------------------------------------------- power-up button

export function PowerupButton({ icon, label, count, onPress, disabled, highlight, free, testID }: {
  icon: string; label: string; count: number; onPress: () => void; disabled?: boolean; highlight?: boolean; free?: boolean; testID?: string;
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = highlight ? withRepeat(withSequence(withTiming(1.15, { duration: 380, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 380 })), -1) : withTiming(1);
  }, [highlight, p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return (
    <Animated.View style={a}>
      <Press onPress={onPress} disabled={disabled} sound="powerup" testID={testID}>
        <View style={[st.pu, shadow.soft, highlight && st.puHot, disabled && { opacity: 0.4 }]}>
          <T size={18}>{icon}</T>
          <T size={10} weight="bold" color={colors.inkSoft}>{label}</T>
          <View style={[st.puCount, { backgroundColor: free ? colors.correct : count > 0 ? colors.accent : colors.gold }]}>
            <T size={10} weight="black" color={colors.white}>{free ? t('free') : count > 0 ? String(count) : '+'}</T>
          </View>
        </View>
      </Press>
    </Animated.View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  title: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingVertical: 12, paddingHorizontal: 14, alignItems: 'center', gap: 6 },
  chips: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 10, height: 22, borderRadius: radius.pill, justifyContent: 'center' },
  dotsWrap: { alignItems: 'center', gap: 3 },
  dots: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  timerDisc: { backgroundColor: colors.surface, borderRadius: 999 },
  center: { alignItems: 'center', justifyContent: 'center' },
  answerWrap: { flex: 1 },
  answer: { minHeight: 58, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 },
  letter: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  answerTextBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  flagSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  flagSmall: { width: 72, height: 54, borderRadius: 4 },
  combo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  comboGlow: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },
  comboPill: { borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  pill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '92%' },
  pillIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pillFlag: { width: 34, height: 25, borderRadius: 4 },
  flagCard: { backgroundColor: colors.surface, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  pu: { width: 62, height: 58, borderRadius: radius.lg, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  puHot: { borderWidth: 2.5, borderColor: colors.correct },
  puCount: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});

export { fonts };
