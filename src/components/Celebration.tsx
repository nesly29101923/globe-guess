// Full-screen moments: level-up, chapter chest, streak milestone, unlocks. Confetti, fanfare, heavy haptic.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { play, type Sfx } from '../feedback/sfx';
import { t } from '../i18n/strings';
import { colors, motion, radius, shadow, type Palette } from '../theme';
import { fx } from './fx';
import { BigButton, PopIn, T } from './ui';
import { usePalette, useStyles } from '../theme/usePalette';

export type CelebrationSpec = {
  kind: 'level' | 'chest' | 'streak' | 'unlock' | 'region' | 'login';
  icon: string;
  title: string;
  subtitle?: string;
  rewards?: { icon: string; label: string }[];
  button?: string;
  sound?: Sfx;
};

export function Celebration({ spec, onClose }: { spec: CelebrationSpec; onClose: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const rays = useSharedValue(0);
  const icon = useSharedValue(0);
  const lid = useSharedValue(0);
  useEffect(() => {
    play(spec.sound ?? (spec.kind === 'chest' ? 'chest' : spec.kind === 'streak' ? 'flame' : spec.kind === 'unlock' ? 'unlock' : 'levelup'));
    haptic.medium();
    fx.confetti(spec.kind !== 'unlock');
    rays.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.linear }), -1);
    icon.value = withSequence(withSpring(1.25, { damping: 6, stiffness: 180 }), withSpring(1, motion.spring));
    if (spec.kind === 'chest') lid.value = withDelay(350, withSequence(withTiming(-1, { duration: 80 }), withTiming(1, { duration: 80 }), withTiming(-1, { duration: 80 }), withTiming(0, { duration: 80 })));
  }, [spec, rays, icon, lid]);
  const raysA = useAnimatedStyle(() => ({ transform: [{ rotate: `${rays.value * 360}deg` }] }));
  const iconA = useAnimatedStyle(() => ({ transform: [{ scale: icon.value }, { rotate: `${lid.value * 8}deg` }] }));
  return (
    <View style={st.dim}>
      <Animated.View style={[st.rays, raysA]} pointerEvents="none">
        {Array.from({ length: 12 }, (_, i) => (
          <View key={i} style={[st.ray, { transform: [{ rotate: `${i * 30}deg` }] }]} />
        ))}
      </Animated.View>
      <Animated.View style={iconA}>
        <T size={96}>{spec.icon}</T>
      </Animated.View>
      <PopIn delay={150}>
        <T size={34} weight="black" color={colors.white} center style={st.titleShadow}>{spec.title}</T>
      </PopIn>
      {spec.subtitle ? (
        <PopIn delay={250}>
          <T size={17} weight="bold" color="rgba(255,255,255,0.9)" center>{spec.subtitle}</T>
        </PopIn>
      ) : null}
      {spec.rewards?.length ? (
        <View style={st.rewards}>
          {spec.rewards.map((r, i) => (
            <PopIn key={i} delay={400 + i * 140} style={[st.reward, shadow.card]}>
              <T size={26}>{r.icon}</T>
              <T size={15} weight="black">{r.label}</T>
            </PopIn>
          ))}
        </View>
      ) : null}
      <PopIn delay={700} style={{ marginTop: 18, alignSelf: 'stretch', paddingHorizontal: 40 }}>
        <BigButton label={spec.button ?? t('collect')} onPress={onClose} breathe testID="celebration-ok" />
      </PopIn>
    </View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(30,16,70,0.86)', alignItems: 'center', justifyContent: 'center', gap: 10, zIndex: 50 },
  rays: { position: 'absolute', width: 700, height: 700, alignItems: 'center', justifyContent: 'center', opacity: 0.18 },
  ray: { position: 'absolute', width: 60, height: 700, backgroundColor: colors.gold, borderRadius: 30 },
  titleShadow: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 3 } },
  rewards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20, marginTop: 8 },
  reward: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', minWidth: 86, gap: 2 },
});
