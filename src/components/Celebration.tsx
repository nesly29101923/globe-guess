// Full-screen moments: level-up, chapter chest, streak milestone, unlocks. Confetti, fanfare, heavy haptic.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { play, type Sfx } from '../feedback/sfx';
import { t } from '../i18n/strings';
import { motion, radius, shadow, type, type Palette } from '../theme';
import { fx } from './fx';
import { RewardIcon, type IconName } from './Icon';
import { BigButton, PopIn, T } from './ui';
import { usePalette, useStyles } from '../theme/usePalette';

export type CelebrationSpec = {
  kind: 'level' | 'chest' | 'streak' | 'unlock' | 'region' | 'login';
  icon: IconName | 'coin';
  title: string;
  subtitle?: string;
  rewards?: { icon: IconName | 'coin'; label: string }[];
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
    rays.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1);
    icon.value = withSequence(withSpring(1.25, { damping: 6, stiffness: 180 }), withSpring(1, motion.spring));
    if (spec.kind === 'chest') lid.value = withDelay(350, withSequence(withTiming(-1, { duration: 80 }), withTiming(1, { duration: 80 }), withTiming(-1, { duration: 80 }), withTiming(0, { duration: 80 })));
  }, [spec, rays, icon, lid]);
  const raysA = useAnimatedStyle(() => ({ transform: [{ rotate: `${rays.value * 360}deg` }] }));
  const iconA = useAnimatedStyle(() => ({ transform: [{ scale: icon.value }, { rotate: `${lid.value * 8}deg` }] }));
  return (
    <View style={st.dim}>
      <Animated.View style={[st.rays, raysA]} pointerEvents="none">
        {Array.from({ length: 4 }, (_, i) => (
          <View key={i} style={[st.ray, { transform: [{ rotate: `${i * 45}deg` }] }]} />
        ))}
      </Animated.View>
      <Animated.View style={[st.iconDisc, shadow.card, iconA]}>
        <RewardIcon name={spec.icon} size={84} />
      </Animated.View>
      <PopIn delay={150}>
        <T size={type.display} weight="black" color={colors.white} center style={st.titleShadow}>{spec.title}</T>
      </PopIn>
      {spec.subtitle ? (
        <PopIn delay={250}>
          <T size={type.heading} weight="bold" color="rgba(255,255,255,0.9)" center>{spec.subtitle}</T>
        </PopIn>
      ) : null}
      {spec.rewards?.length ? (
        <View style={st.rewards}>
          {spec.rewards.map((r, i) => (
            <PopIn key={i} delay={400 + i * 140} style={[st.reward, shadow.card]}>
              <RewardIcon name={r.icon} size={30} />
              <T size={type.label} weight="black" center lines={2}>{r.label}</T>
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
  iconDisc: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  // four bars through the centre make eight rays; the colour carries the transparency (no group opacity)
  rays: { position: 'absolute', width: 700, height: 700, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 70, height: 700, backgroundColor: 'rgba(245,158,11,0.16)' },
  titleShadow: { textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 3 } },
  rewards: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 20, marginTop: 8 },
  reward: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', width: 96, minHeight: 84, gap: 4, justifyContent: 'center' },
});
