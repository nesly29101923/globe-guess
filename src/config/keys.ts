// Store and SDK keys. Empty = the fake services stay in place (see HANDOFF.md).
// The AdMob app IDs in app.json are Google's public sample IDs: replace them with ours before release.
export const KEYS = {
  admob: {
    // set to true to try real AdMob test ads in a development build (Google's test ad units, no revenue)
    useTestAds: false,
    rewardedAndroid: '',
    rewardedIos: '',
    interstitialAndroid: '',
    interstitialIos: '',
  },
  revenueCat: { android: '', ios: '' },
};
