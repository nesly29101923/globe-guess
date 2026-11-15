import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useGame } from '../store/store';

// Few and short: one light pulse for a right answer, one medium for a miss, one for big celebrations.

const on = () => Platform.OS !== 'web' && useGame.getState().save.settings.haptics;

export const haptic = {
  tap: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  error: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  medium: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  tick: () => on() && Haptics.selectionAsync().catch(() => {}),
};
