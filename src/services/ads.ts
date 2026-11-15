// Ads behind one interface. Game code calls only this file. The fake provider shows a 2-second placeholder
// (AdHost renders it) so every flow can be tested. Replace with AppLovin MAX / AdMob mediation: see HANDOFF.md.
import { analytics } from './analytics';

export type Placement =
  | 'double_coins' | 'extra_heart' | 'survival_continue' | 'second_chance' | 'free_coins' | 'streak_repair' | 'between_rounds';

export interface AdsProvider {
  init(opts: { personalised: boolean; childDirected: false }): Promise<void>;
  rewardedReady(): boolean;
  showRewarded(p: Placement): Promise<boolean>;
  showInterstitial(p: Placement): Promise<void>;
}

type Listener = (req: { kind: 'rewarded' | 'interstitial'; placement: Placement; done: (watched: boolean) => void } | null) => void;
let listener: Listener | null = null;

/** AdHost subscribes here to draw the fake ad. */
export function onFakeAd(l: Listener) {
  listener = l;
  return () => {
    if (listener === l) listener = null;
  };
}

let fakeFill = true;
/** For testing the "no ad loaded" path: the button must hide, never fail. */
export function setFakeFill(v: boolean) {
  fakeFill = v;
}

class FakeAds implements AdsProvider {
  async init() {}
  rewardedReady() {
    return fakeFill;
  }
  showRewarded(placement: Placement) {
    return new Promise<boolean>((resolve) => {
      if (!listener) return resolve(true);
      listener({ kind: 'rewarded', placement, done: (w) => { listener?.(null); resolve(w); } });
    });
  }
  showInterstitial(placement: Placement) {
    return new Promise<void>((resolve) => {
      if (!listener) return resolve();
      listener({ kind: 'interstitial', placement, done: () => { listener?.(null); resolve(); } });
    });
  }
}

let provider: AdsProvider = new FakeAds();
export function setAdsProvider(p: AdsProvider) {
  provider = p;
}

export const ads = {
  init: (personalised: boolean) => provider.init({ personalised, childDirected: false }),
  rewardedReady: () => provider.rewardedReady(),
  offerShown: (placement: Placement) => analytics.log('ad_offer_shown', { placement, type: 'rewarded' }),
  async rewarded(placement: Placement): Promise<boolean> {
    analytics.log('ad_started', { placement, type: 'rewarded' });
    const ok = await provider.showRewarded(placement);
    if (ok) analytics.log('ad_completed', { placement, type: 'rewarded' });
    return ok;
  },
  async interstitial(placement: Placement): Promise<void> {
    analytics.log('ad_started', { placement, type: 'interstitial' });
    await provider.showInterstitial(placement);
    analytics.log('ad_completed', { placement, type: 'interstitial' });
  },
};
