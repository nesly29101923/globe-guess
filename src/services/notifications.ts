// Local notifications only (no server). Asked after a good moment, never at launch. Few and useful:
// Daily Challenge ready, streak about to break (evening), hearts full.
import { Platform } from 'react-native';
import { t } from '../i18n/strings';
import { analytics } from './analytics';

type NotificationsModule = typeof import('expo-notifications');
let N: NotificationsModule | null = null;
function mod(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (!N) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      N = require('expo-notifications') as NotificationsModule;
    } catch {
      N = null;
    }
  }
  return N;
}

export async function requestPermission(): Promise<boolean> {
  const n = mod();
  if (!n) return false;
  try {
    const r = await n.requestPermissionsAsync();
    analytics.log('notification_permission', { granted: r.granted });
    return r.granted;
  } catch {
    return false;
  }
}

/** Reschedule everything from the current state. Safe to call often. */
export async function schedule(opts: { enabled: boolean; streak: number; playedToday: boolean; heartsFullInMs: number; now: number }) {
  const n = mod();
  if (!n) return;
  try {
    await n.cancelAllScheduledNotificationsAsync();
    if (!opts.enabled) return;
    const perm = await n.getPermissionsAsync();
    if (!perm.granted) return;
    const d = new Date(opts.now);
    const tomorrow9 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 9, 0, 0);
    await n.scheduleNotificationAsync({
      content: { title: t('notif_daily_title'), body: t('notif_daily_body') },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: tomorrow9 },
    });
    if (opts.streak >= 2) {
      // tonight if not played yet today, otherwise tomorrow evening
      const base = opts.playedToday ? 1 : 0;
      const evening = new Date(d.getFullYear(), d.getMonth(), d.getDate() + base, 19, 30, 0);
      if (evening.getTime() > opts.now) {
        await n.scheduleNotificationAsync({
          content: { title: t('notif_streak_title', { n: opts.streak + (opts.playedToday ? 1 : 0) }), body: t('notif_streak_body') },
          trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: evening },
        });
      }
    }
    if (opts.heartsFullInMs > 0) {
      await n.scheduleNotificationAsync({
        content: { title: t('notif_hearts_title'), body: t('notif_hearts_body') },
        trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(opts.now + opts.heartsFullInMs) },
      });
    }
  } catch {
    /* notifications are a nice-to-have */
  }
}
