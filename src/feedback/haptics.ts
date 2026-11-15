import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useGame } from '../store/store';

const on = () => Platform.OS !== 'web' && useGame.getState().save.settings.haptics;

export const haptic = {
  tap: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  success: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  error: () => on() && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
  heavy: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  medium: () => on() && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  tick: () => on() && Haptics.selectionAsync().catch(() => {}),
};
