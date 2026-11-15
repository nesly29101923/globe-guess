// When to ask for notifications (after a good moment, with a sentence saying why) and keeping them scheduled.
import { balance } from '../config/balance';
import { heartsNow } from '../logic/journey';
import { schedule } from '../services/notifications';
import { useGame } from '../store/store';
import { askPrompt } from './hosts';

export function maybeAskNotifications(_reason: 'streak' | 'daily') {
  const g = useGame.getState();
  if (g.save.prompts.notifications !== 'never' || g.session.firstSession && _reason !== 'streak') return;
  if (g.save.totalRounds < 2) return;
  pending = true; // shown on the home screen, never over a round or a celebration
}

let pending = false;
/** Home calls this when it appears: shows the reminder pre-prompt if a good moment just happened. */
export function showPendingNotificationAsk() {
  if (!pending) return;
  pending = false;
  setTimeout(() => askPrompt('notifications'), 900);
}

export function refreshNotifications() {
  const g = useGame.getState();
  const s = g.save;
  const now = g.now();
  const h = heartsNow(s, now);
  schedule({
    enabled: s.settings.notifications,
    streak: s.streak.count,
    playedToday: s.streak.lastDay === g.today(),
    heartsFullInMs: h.count < balance.hearts.max ? h.nextInMs + (balance.hearts.max - h.count - 1) * balance.hearts.refillMinutes * 60000 : 0,
    now,
  });
}
