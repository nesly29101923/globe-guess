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
import { fonts, motion, radius, shadow, sizes, tierColors, type, type Palette } from '../theme';
import { useTicker, type Ticker } from '../game/ticker';
import { Icon, type IconName } from './Icon';
import { fitSize, Press, T } from './ui';
import { usePalette, useStyles } from '../theme/usePalette';

// ---------------------------------------------------------------- title card

/** The question, on one line. Topic and difficulty are not repeated here: the difficulty sits next to "3/10". */
export function TitleCard({ title, style }: { title: string; style?: StyleProp<ViewStyle> }) {
  const st = useStyles(make_st);
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = 0;
    v.value = withSpring(1, motion.springSoft);
  }, [title, v]);
  const a = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ translateY: (1 - v.value) * -24 }] }));
  const f = fitSize(title, type.title, 280, 15, 0.66);
  return (
    <Animated.View style={[st.title, shadow.card, style, a]}>
      <T size={f.size} weight="black" center lines={1} shrink>{title}</T>
    </Animated.View>
  );
}

// ---------------------------------------------------------------- progress dots

export function ProgressDots({ total, index, results, tier }: { total: number; index: number; results: (boolean | null)[]; tier?: string }) {
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
      <View style={st.dotsCaption}>
        <T size={type.caption} weight="black" color={colors.inkSoft}>{`${Math.min(index + 1, total)}/${total}`}</T>
        {tier ? <T size={type.caption} weight="black" color={tierColors[tier] ?? colors.accent}>{upper(t(`tier_${tier}` as never))}</T> : null}
      </View>
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

export function TimerRing({ progress, seconds, size = 76, frozen }: { progress: SharedValue<number>; seconds: Ticker; size?: number; frozen?: boolean }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const secondsLeft = useTicker(seconds);
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
    <View style={[{ width: size, height: size }, st.timerDisc]}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={size / 2} cy={size / 2} r={r} color={colors.track} style="stroke" strokeWidth={stroke} />
        <Path path={path} color={frozen ? '#38BDF8' : color} style="stroke" strokeWidth={stroke} strokeCap="round" end={progress} />
      </Canvas>
      <Animated.View style={[StyleSheet.absoluteFill, st.center, a]}>
        {frozen ? <Icon name="snowflake" size={30} color="#0EA5E9" /> : <T size={type.display - 2} weight="black" color={urgent ? colors.wrong : colors.ink}>{String(Math.max(0, secondsLeft))}</T>}
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------- answer button

export type ButtonState = 'idle' | 'correct' | 'wrong' | 'faded' | 'removed';

/** Room for the answer text inside a button of width w (letter badge, gaps and the tick/cross slot taken off). */
export function answerTextWidth(w: number): number {
  return w - 16 - 26 - 12 - 4 - 6; // paddings, letter badge, gaps, spacer, borders
}

export function AnswerButton({
  letter, label, flagId, state, onPress, index, disabled, skin = 'btn_classic', revealKey, testID, width = 140, fontSize, lines,
}: {
  letter: string; label: string; flagId?: string; state: ButtonState; onPress: () => void; index: number; disabled: boolean;
  skin?: string; revealKey: string; testID?: string; width?: number; fontSize?: number; lines?: number;
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
  // the round passes one size for all four answers; this is only the fallback
  const f = fontSize ? { size: fontSize, lines: lines ?? 1 } : fitSize(upper(label), type.body, answerTextWidth(width), 11, 0.7);
  return (
    <Animated.View style={[st.answerWrap, a]}>
      <Press onPress={onPress} disabled={disabled || state === 'removed'} sound={null} scaleTo={0.94} testID={testID}>
        <Animated.View style={[st.answer, shadow.card, sk.border ? { borderWidth: 2, borderColor: sk.border } : null, bgA]}>
          <View style={[st.letter, { backgroundColor: isRight || isWrong ? 'rgba(255,255,255,0.25)' : sk.badgeBg }]}>
            {isRight ? <Icon name="check-bold" size={16} color={colors.white} /> : isWrong ? <Icon name="close-thick" size={16} color={colors.white} />
              : <T size={type.label} weight="black" color={sk.badgeText}>{letter}</T>}
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
          <View style={{ width: 4 }} />
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
  const a = useAnimatedStyle(() => ({ opacity: s.value > 0.05 ? 1 : 0, transform: [{ scale: s.value }, { rotate: `${-4 + 3 * flame.value}deg` }] }));
  const hot = combo >= 3;
  const bg = combo >= 5 ? colors.flame : combo >= 3 ? colors.gold : colors.accent;
  return (
    <Animated.View style={[st.combo, a]} pointerEvents="none">
      <View style={[st.comboPill, { backgroundColor: bg }, shadow.card]}>
        <View style={st.comboHead}>
          {combo >= 5 ? <Icon name="fire" size={14} color={colors.white} /> : null}
          <T size={type.caption} weight="bold" color={colors.white}>{t('combo')}</T>
        </View>
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
  const f = fitSize(upper(name), type.title, 260, 13, 0.66);
  return (
    <Animated.View style={[st.pill, shadow.card, a]} pointerEvents="none">
      {flagId && FLAG_IMAGES[flagId] ? <Image source={FLAG_IMAGES[flagId]} style={st.pillFlag} contentFit="cover" /> : (
        <View style={[st.pillIcon, { backgroundColor: correct ? colors.correct : colors.wrong }]}>
          <Icon name={correct ? 'check-bold' : 'exclamation-thick'} size={16} color={colors.white} />
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

/** Power-up colours: each one is recognised by colour before its icon is read. */
const PU_COLORS: Partial<Record<string, string>> = { 'circle-half-full': '#8B5CF6', snowflake: '#0EA5E9', 'skip-next': '#F59E0B', 'backup-restore': '#16A34A' };

export function PowerupButton({ icon, label, count, onPress, disabled, highlight, free, testID }: {
  icon: IconName; label: string; count: number; onPress: () => void; disabled?: boolean; highlight?: boolean; free?: boolean; testID?: string;
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
        {/* a round coloured button per power-up: the colour and icon say what it is, the badge how many */}
        <View style={[st.pu, { backgroundColor: PU_COLORS[icon] ?? colors.accent }, highlight && st.puHot, disabled && { opacity: 0.45 }]} accessibilityLabel={label}>
          <Icon name={icon} size={30} color="#FFFFFF" />
          <View style={[st.puCount, { backgroundColor: free ? colors.correct : colors.ink }]}>
            <T size={type.caption} weight="black" color={colors.white}>{free ? t('free') : String(count)}</T>
          </View>
        </View>
      </Press>
    </Animated.View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  title: { backgroundColor: colors.surface, borderRadius: radius.lg, height: 52, paddingHorizontal: 52, alignItems: 'center', justifyContent: 'center' },
  dotsCaption: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, height: 20 },
  dotsWrap: { alignItems: 'center', gap: 3 },
  dots: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  timerDisc: { backgroundColor: colors.surface, borderRadius: 999 },
  center: { alignItems: 'center', justifyContent: 'center' },
  answerWrap: { flex: 1 },
  answer: { height: 58, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 6 },
  mark: { width: 18, alignItems: 'center' },
  comboHead: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  letter: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  answerTextBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  flagSlot: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  flagSmall: { width: 72, height: 54, borderRadius: 4 },
  combo: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  comboPill: { borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 4, alignItems: 'center' },
  pill: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '92%' },
  pillIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  pillFlag: { width: 34, height: 25, borderRadius: 4 },
  flagCard: { backgroundColor: colors.surface, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  pu: { width: sizes.big, height: sizes.big, borderRadius: sizes.big / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#FFFFFF', borderBottomWidth: 6, borderBottomColor: 'rgba(15,23,42,0.28)' },
  puHot: { borderColor: colors.correct, borderBottomColor: colors.correct },
  puCount: { position: 'absolute', top: -6, right: -8, minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
});

export { fonts };

// ---------------------------------------------------------------- daily grid (right / wrong squares)

export function GridSquares({ results, size = 18 }: { results: boolean[]; size?: number }) {
  const colors = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 4, paddingVertical: 4 }}>
      {results.map((r, i) => (
        <View key={i} style={{ width: size, height: size, borderRadius: 4, backgroundColor: r ? colors.correct : colors.wrong }} />
      ))}
    </View>
  );
}
