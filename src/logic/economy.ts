// Spending and ad pacing rules (pure).
import { balance } from '../config/balance';
import { COSMETICS, PRODUCTS, STARTER } from '../config/cosmetics';
import { refillHearts } from './journey';
import type { PowerupId, SaveState } from './save';

export type ShopItem = 'fiftyFifty' | 'freeze' | 'skip' | 'secondChance' | 'streakFreeze' | 'heartRefill';

export function priceOf(item: ShopItem): number {
  return balance.prices[item];
}

export function canAfford(s: SaveState, price: number): boolean {
  return s.coins >= price;
}

export function buy(s: SaveState, item: ShopItem, now: number): { state: SaveState; ok: boolean; reason?: string } {
  const price = priceOf(item);
  if (s.coins < price) return { state: s, ok: false, reason: 'coins' };
  if (item === 'streakFreeze') {
    if (s.streak.freezes >= balance.daily.streakFreezeMax) return { state: s, ok: false, reason: 'max' };
    return { state: { ...s, coins: s.coins - price, streak: { ...s.streak, freezes: s.streak.freezes + 1 } }, ok: true };
  }
  if (item === 'heartRefill') {
    return { state: { ...refillHearts(s, now), coins: s.coins - price }, ok: true };
  }
  const id = item as PowerupId;
  return { state: { ...s, coins: s.coins - price, powerups: { ...s.powerups, [id]: s.powerups[id] + 1 } }, ok: true };
}

export function buyCosmetic(s: SaveState, id: string): { state: SaveState; ok: boolean } {
  const c = COSMETICS.find((x) => x.id === id);
  if (!c || c.price == null || s.cosmetics.owned.includes(id) || s.coins < c.price) return { state: s, ok: false };
  return { state: { ...s, coins: s.coins - c.price, cosmetics: { ...s.cosmetics, owned: [...s.cosmetics.owned, id] } }, ok: true };
}

export function spendPowerup(s: SaveState, id: PowerupId): SaveState | null {
  if (s.powerups[id] <= 0) return null;
  return { ...s, powerups: { ...s.powerups, [id]: s.powerups[id] - 1 } };
}

// ---------------------------------------------------------------- ads

export function adsRemoved(s: SaveState, now: number): boolean {
  return s.ads.removed || s.ads.removedUntil > now;
}

/** Interstitial allowed at this natural break? Never in the first session, never before N rounds, paced. */
export function interstitialAllowed(s: SaveState, now: number, opts: { firstSession: boolean; afterRewarded: boolean }): boolean {
  const a = balance.ads;
  if (adsRemoved(s, now) || opts.firstSession || opts.afterRewarded) return false;
  if (s.totalRounds < a.interstitialMinTotalRounds) return false;
  if (s.ads.roundsSinceInterstitial < a.interstitialEveryRounds) return false;
  return now - s.ads.lastInterstitialAt >= a.interstitialMinSeconds * 1000;
}

export function noteRoundForAds(s: SaveState): SaveState {
  return { ...s, ads: { ...s.ads, roundsSinceInterstitial: s.ads.roundsSinceInterstitial + 1 } };
}

export function noteInterstitial(s: SaveState, now: number): SaveState {
  return { ...s, ads: { ...s.ads, roundsSinceInterstitial: 0, lastInterstitialAt: now } };
}

export function freeCoinsLeft(s: SaveState, day: string): number {
  const used = s.ads.freeCoins.day === day ? s.ads.freeCoins.count : 0;
  return Math.max(0, balance.ads.rewardedFreeCoinsPerDay - used);
}

export function grantFreeCoins(s: SaveState, day: string): SaveState {
  if (freeCoinsLeft(s, day) <= 0) return s;
  const used = s.ads.freeCoins.day === day ? s.ads.freeCoins.count : 0;
  return { ...s, coins: s.coins + balance.ads.rewardedFreeCoins, ads: { ...s.ads, freeCoins: { day, count: used + 1 } } };
}

// ---------------------------------------------------------------- store products


/** Grant what a purchase contains. Pure: the purchase service confirms first. */
export function grantProduct(s: SaveState, productId: string, now: number): SaveState {
  const p = PRODUCTS.find((x) => x.id === productId);
  if (!p) return s;
  if (p.kind === 'remove_ads') return { ...s, ads: { ...s.ads, removed: true } };
  if (p.kind === 'coins') return { ...s, coins: s.coins + (p.coins ?? 0) };
  // starter pack: once
  if (s.shop.starterBought) return s;
  const n = STARTER.powerupsEach;
  return {
    ...s,
    coins: s.coins + STARTER.coins,
    powerups: { fiftyFifty: s.powerups.fiftyFifty + n, freeze: s.powerups.freeze + n, skip: s.powerups.skip + n, secondChance: s.powerups.secondChance + n },
    cosmetics: { ...s.cosmetics, owned: s.cosmetics.owned.includes(STARTER.theme) ? s.cosmetics.owned : [...s.cosmetics.owned, STARTER.theme] },
    ads: { ...s.ads, removedUntil: Math.max(s.ads.removedUntil, now) + STARTER.removeAdsDays * 86400000 },
    shop: { ...s.shop, starterBought: true },
  };
}

/** The Starter Pack is offered from day 2 (never in the first session), until bought. */
export function starterAvailable(s: SaveState, now: number, firstSession: boolean): boolean {
  return !s.shop.starterBought && !firstSession && now - s.createdAt >= (STARTER.fromDay - 1) * 86400000;
}
