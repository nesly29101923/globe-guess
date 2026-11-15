// Small building blocks shared by every screen: pressable with feedback, text, buttons, chips, cards.
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { play, type Sfx } from '../feedback/sfx';
import { colors, fonts, motion, radius, shadow, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

/** Every tap answers within 100 ms: press-down spring, sound, light haptic. */
export function Press({
  onPress, children, style, disabled, sound = 'tap', scaleTo = motion.pressScale, hitSlop = 6, testID, silent,
}: {
  onPress?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle>; disabled?: boolean; sound?: Sfx | null;
  scaleTo?: number; hitSlop?: number; testID?: string; silent?: boolean;
}) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable
      testID={testID}
      style={style}
      accessibilityRole="button"
      hitSlop={hitSlop}
      disabled={disabled}
      onPressIn={() => {
        s.value = withSpring(scaleTo, motion.spring);
        if (!silent) {
          if (sound) play(sound);
        }
      }}
      onPressOut={() => {
        s.value = withSpring(1, motion.spring);
      }}
      onPress={onPress}
    >
      <Animated.View style={a}>{children}</Animated.View>
    </Pressable>
  );
}

export function T({ children, style, size = 16, weight = 'bold', color, lines, center, shrink }: {
  children: React.ReactNode; style?: StyleProp<TextStyle>; size?: number; weight?: keyof typeof fonts; color?: string;
  lines?: number; center?: boolean; shrink?: boolean;
}) {
  const pal = usePalette();
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      adjustsFontSizeToFit={shrink}
      minimumFontScale={0.6}
      style={[{ fontFamily: fonts[weight], fontSize: size, color: color ?? pal.ink, textAlign: center ? 'center' : undefined, includeFontPadding: false }, style]}
    >
      {children}
    </Text>
  );
}

/** Font size that fits a label into a box: shrink down to a readable minimum, then wrap to two lines.
 *  `width` is the text box width in dp; Poppins Bold capitals are about 0.7 em wide. */
export function fitSize(text: string, base: number, width: number, min: number, em = 0.7): { size: number; lines: number } {
  const len = Math.max(1, text.length);
  const one = width / (len * em);
  if (one >= base) return { size: base, lines: 1 };
  if (one >= min) return { size: Math.floor(one), lines: 1 };
  // two lines, then three for the longest names ("Central African Republic")
  for (const n of [2, 3]) {
    const longest = Math.max(...splitN(text, n).map((x) => x.length));
    const size = Math.min(base - (n - 1) * 1.5, Math.floor(width / (longest * em)));
    if (size >= min - 1 || n === 3) return { size: Math.max(min - 2, size), lines: n };
  }
  return { size: min, lines: 3 };
}

/** Split words into n lines with the shortest longest line. */
function splitN(text: string, n: number): string[] {
  const words = text.split(' ');
  if (n <= 1 || words.length <= 1) return [text];
  if (n === 2) return splitTwo(text);
  let best: string[] = [text];
  let bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const rest = splitTwo(words.slice(i).join(' '));
    const parts = [words.slice(0, i).join(' '), ...rest];
    const m = Math.max(...parts.map((p) => p.length));
    if (m < bestMax) {
      bestMax = m;
      best = parts;
    }
  }
  return best;
}

function splitTwo(text: string): string[] {
  const words = text.split(' ');
  if (words.length < 2) return [text];
  let best: string[] = [text];
  let bestMax = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const m = Math.max(a.length, b.length);
    if (m < bestMax) {
      bestMax = m;
      best = [a, b];
    }
  }
  return best;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(make_styles);
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, bg, color, style }: { label: string; bg?: string; color?: string; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(make_styles);
  return (
    <View style={[styles.chip, { backgroundColor: bg ?? colors.chip }, style]}>
      <T size={12} weight="bold" color={color ?? colors.ink}>{label}</T>
    </View>
  );
}

/** The one primary action per screen: big, accent, breathing slowly when idle. */
export function BigButton({ label, onPress, color = colors.accent, textColor = colors.white, breathe, icon, sub, disabled, testID, style }: {
  label: string; onPress: () => void; color?: string; textColor?: string; breathe?: boolean; icon?: string; sub?: string;
  disabled?: boolean; testID?: string; style?: StyleProp<ViewStyle>;
}) {
  const colors = usePalette();
  const styles = useStyles(make_styles);
  const b = useSharedValue(1);
  useEffect(() => {
    if (breathe && !disabled) b.value = withRepeat(withSequence(withTiming(1.04, { duration: motion.breathe / 2, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: motion.breathe / 2, easing: Easing.inOut(Easing.sin) })), -1);
    else b.value = withTiming(1);
  }, [breathe, disabled, b]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: b.value }] }));
  return (
    <Animated.View style={[a, style]}>
      <Press onPress={onPress} disabled={disabled} testID={testID}>
        <View style={[styles.big, { backgroundColor: disabled ? colors.disabled : color }, shadow.card]}>
          <View style={styles.bigInner}>
            {icon ? <T size={22}>{icon}</T> : null}
            <T size={20} weight="black" color={textColor}>{label}</T>
          </View>
          {sub ? <T size={12} weight="semi" color={textColor} style={{ opacity: 0.85 }}>{sub}</T> : null}
        </View>
      </Press>
    </Animated.View>
  );
}

export function SmallButton({ label, onPress, icon, color: colorIn, textColor: textIn, disabled, testID, style }: {
  label: string; onPress: () => void; icon?: string; color?: string; textColor?: string; disabled?: boolean; testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = usePalette();
  const styles = useStyles(make_styles);
  const color = colorIn ?? colors.surface;
  const textColor = textIn ?? colors.ink;
  return (
    <Press onPress={onPress} disabled={disabled} testID={testID} style={style}>
      <View style={[styles.small, { backgroundColor: disabled ? colors.chip : color, opacity: disabled ? 0.6 : 1 }, shadow.soft]}>
        {icon ? <T size={16}>{icon}</T> : null}
        <T size={14} weight="bold" color={disabled ? colors.inkSoft : textColor}>{label}</T>
      </View>
    </Press>
  );
}

/** Pops in with a little overshoot after `delay` ms. */
export function PopIn({ children, delay = 0, style, from = 0.6 }: { children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle>; from?: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withSpring(1, motion.spring));
  }, [delay, v]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 1.6), transform: [{ scale: from + (1 - from) * v.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** A red dot for anything claimable. */
export function Dot({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useStyles(make_styles);
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withRepeat(withSequence(withTiming(1.25, { duration: 500 }), withTiming(1, { duration: 500 })), -1);
  }, [v]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: v.value }] }));
  return <Animated.View style={[styles.dot, style, a]} />;
}

export function ProgressBar({ value, color = colors.accent, height = 10, track: trackIn }: { value: number; color?: string; height?: number; track?: string }) {
  const track = trackIn ?? usePalette().track;
  const w = useSharedValue(value);
  useEffect(() => {
    w.value = withTiming(Math.max(0, Math.min(1, value)), { duration: motion.countUp, easing: Easing.out(Easing.cubic) });
  }, [value, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color }, a]} />
    </View>
  );
}

export const make_styles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, ...shadow.card },
  chip: { paddingHorizontal: 10, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  big: { minHeight: 62, borderRadius: radius.xl, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  bigInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  small: { minHeight: 48, borderRadius: radius.lg, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { position: 'absolute', top: -3, right: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.wrong, borderWidth: 2, borderColor: colors.white },
});
