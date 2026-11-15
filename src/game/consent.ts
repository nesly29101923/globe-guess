// Consent flows. The real build replaces the in-game sheet with the ad SDK's consent message (Google UMP for
// European players) and the iOS tracking prompt; both are asked after the first session, never at launch.
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { ads } from '../services/ads';
import { useGame } from '../store/store';
import { askPrompt } from './hosts';
import { gatherAdConsent, requestTracking } from '../services/real';

const EEA_UK_CH = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH']);

let personalisedAds = false;

export function needsConsentMessage(): boolean {
  try {
    const region = getLocales()[0]?.regionCode ?? '';
    return EEA_UK_CH.has(region.toUpperCase());
  } catch {
    return true; // unknown region: ask
  }
}

/** Called at the start of a session: never in the first session. */
export function maybeAskConsent() {
  const g = useGame.getState();
  if (g.session.firstSession || g.save.prompts.tracking !== 'never') {
    ads.init(personalisedAds);
    return;
  }
  // real SDK present: Google's consent message (EEA/UK) and the iOS tracking prompt, after the first session
  gatherAdConsent().then(async (canRequest) => {
    if (canRequest !== null) {
      await requestTracking();
      applyConsent(canRequest);
      return;
    }
    // fake ads (no keys yet): our own sheet stands in for the consent message
    if (needsConsentMessage() || Platform.OS === 'ios') setTimeout(() => askPrompt('consent'), 1200);
    else applyConsent(true);
  });
}

export function applyConsent(personalised: boolean) {
  personalisedAds = personalised;
  useGame.getState().update((s) => ({ ...s, prompts: { ...s.prompts, tracking: 'asked' } }));
  ads.init(personalised);
}
