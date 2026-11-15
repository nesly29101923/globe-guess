// Analytics behind one interface. The fake keeps the last events in memory and logs them in development.
export type EventName =
  | 'first_open' | 'tutorial_round_start' | 'tutorial_round_end' | 'round_start' | 'round_end'
  | 'question_answered' | 'level_up' | 'daily_challenge_end' | 'streak_updated' | 'mission_completed'
  | 'daily_reward_claimed' | 'coins_earned' | 'coins_spent' | 'ad_offer_shown' | 'ad_started' | 'ad_completed'
  | 'shop_opened' | 'purchase_started' | 'purchase_completed' | 'share_tapped' | 'notification_permission';

export type Params = Record<string, string | number | boolean | null | undefined>;

export interface AnalyticsProvider {
  log(name: EventName, params?: Params): void;
  setUserProperty(name: string, value: string): void;
}

const buffer: { name: EventName; params?: Params; at: number }[] = [];

class FakeAnalytics implements AnalyticsProvider {
  log(name: EventName, params?: Params) {
    buffer.push({ name, params, at: Date.now() });
    if (buffer.length > 500) buffer.shift();
    if (__DEV__) console.log(`[analytics] ${name}`, params ?? {});
  }
  setUserProperty() {}
}

let provider: AnalyticsProvider = new FakeAnalytics();

/** Swap in the real provider (Firebase) once keys exist; see HANDOFF.md. */
export function setAnalyticsProvider(p: AnalyticsProvider) {
  provider = p;
}

export const analytics = {
  log: (name: EventName, params?: Params) => {
    try {
      provider.log(name, params);
    } catch {
      /* analytics must never break the game */
    }
  },
  recent: () => buffer.slice(),
};

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (window as unknown as Record<string, unknown>).__analytics = buffer;
}
