// Real SDKs behind the service interfaces. Installed only when keys exist (src/config/keys.ts).
import { Platform } from 'react-native';
import mobileAds, { AdEventType, AdsConsent, InterstitialAd, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import Purchases from 'react-native-purchases';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { PRODUCTS } from '../config/cosmetics';
import { KEYS } from '../config/keys';
import { restoreAudioSession } from '../feedback/sfx';
import { setAdsProvider, type AdsProvider, type Placement } from './ads';
import { setPurchasesProvider, type PurchasesProvider } from './purchases';

const ios = Platform.OS === 'ios';

class AdMobProvider implements AdsProvider {
  private rewarded: RewardedAd;
  private interstitial: InterstitialAd;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private personalised = false;
  constructor(rewardedId: string, interstitialId: string) {
    this.rewarded = RewardedAd.createForAdRequest(rewardedId);
    this.interstitial = InterstitialAd.createForAdRequest(interstitialId);
    this.rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => (this.rewardedLoaded = true));
    this.interstitial.addAdEventListener(AdEventType.LOADED, () => (this.interstitialLoaded = true));
  }
  async init(opts: { personalised: boolean }) {
    this.personalised = opts.personalised;
    await mobileAds().setRequestConfiguration({ tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false });
    await mobileAds().initialize();
    this.rewarded.load();
    this.interstitial.load();
  }
  rewardedReady() {
    return this.rewardedLoaded;
  }
  showRewarded(_p: Placement) {
    return new Promise<boolean>((resolve) => {
      if (!this.rewardedLoaded) return resolve(false);
      let earned = false;
      const offEarn = this.rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => (earned = true));
      const offClose = this.rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        offEarn();
        offClose();
        this.rewardedLoaded = false;
        this.rewarded.load();
        // The ads SDK switches the audio session for video ads; put ours back so the player's music keeps mixing.
        void restoreAudioSession();
        resolve(earned);
      });
      this.rewarded.show().catch(() => resolve(false));
    });
  }
  showInterstitial(_p: Placement) {
    return new Promise<void>((resolve) => {
      if (!this.interstitialLoaded) return resolve();
      const off = this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        off();
        this.interstitialLoaded = false;
        this.interstitial.load();
        void restoreAudioSession();
        resolve();
      });
      this.interstitial.show().catch(() => resolve());
    });
  }
}

class RevenueCatProvider implements PurchasesProvider {
  constructor(private apiKey: string) {}
  async init() {
    Purchases.configure({ apiKey: this.apiKey });
  }
  async products() {
    const store = await Purchases.getProducts(PRODUCTS.map((p) => p.id));
    return PRODUCTS.map((p) => ({ ...p, localizedPrice: store.find((s) => s.identifier === p.id)?.priceString ?? p.price }));
  }
  async buy(productId: string) {
    try {
      const [product] = await Purchases.getProducts([productId]);
      if (!product) return { ok: false, productId };
      await Purchases.purchaseStoreProduct(product);
      return { ok: true, productId };
    } catch (e) {
      return { ok: false, productId, cancelled: !!(e as { userCancelled?: boolean }).userCancelled };
    }
  }
  async restore() {
    const info = await Purchases.restorePurchases();
    return (info.allPurchasedProductIdentifiers ?? []).filter((id) => id === 'remove_ads');
  }
}

export function installRealProviders() {
  const a = KEYS.admob;
  const rewardedId = ios ? a.rewardedIos : a.rewardedAndroid;
  const interstitialId = ios ? a.interstitialIos : a.interstitialAndroid;
  if (rewardedId && interstitialId) setAdsProvider(new AdMobProvider(rewardedId, interstitialId));
  else if (a.useTestAds) setAdsProvider(new AdMobProvider(TestIds.REWARDED, TestIds.INTERSTITIAL));
  const rc = ios ? KEYS.revenueCat.ios : KEYS.revenueCat.android;
  if (rc) setPurchasesProvider(new RevenueCatProvider(rc));
}

/** Google's consent message (UMP) for players who need one. Returns whether ads may be requested. */
export async function gatherAdConsent(): Promise<boolean | null> {
  if (!KEYS.admob.useTestAds && !KEYS.admob.rewardedAndroid && !KEYS.admob.rewardedIos) return null;
  try {
    const info = await AdsConsent.gatherConsent();
    return info.canRequestAds;
  } catch {
    return null;
  }
}

export async function requestTracking() {
  if (!ios) return;
  try {
    await requestTrackingPermissionsAsync();
  } catch {
    /* ignore */
  }
}
