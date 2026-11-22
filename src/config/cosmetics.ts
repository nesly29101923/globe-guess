// Cosmetics and store products. Prices in coins are hours of play (1 h = 1,500 coins); see config/balance.ts.

export type Cosmetic = {
  id: string;
  kind: 'map' | 'button' | 'badge';
  theme?: string;          // map theme id in src/theme
  price: number | null;    // coins; null = not for coins (purchase or reward only)
  source?: 'starter' | 'streak' | 'level';
};

export const COSMETICS: Cosmetic[] = [
  { id: 'classic', kind: 'map', theme: 'classic', price: 0 },
  { id: 'mint', kind: 'map', theme: 'mint', price: null, source: 'level' },
  { id: 'sunset', kind: 'map', theme: 'sunset', price: 3000 },
  { id: 'night', kind: 'map', theme: 'night', price: 4500 },
  { id: 'parchment', kind: 'map', theme: 'parchment', price: 6000 },
  { id: 'arctic', kind: 'map', theme: 'arctic', price: 7500 },
  { id: 'royal', kind: 'map', theme: 'royal', price: 9000 },
  { id: 'neon', kind: 'map', theme: 'neon', price: null, source: 'starter' },
  { id: 'btn_classic', kind: 'button', price: 0 },
  { id: 'btn_bubble', kind: 'button', price: null, source: 'level' },
  { id: 'btn_ink', kind: 'button', price: 1500 },
  { id: 'btn_gold', kind: 'button', price: 3000 },
  { id: 'btn_mint', kind: 'button', price: 2000 },
  { id: 'btn_candy', kind: 'button', price: 3500 },
  { id: 'btn_ocean', kind: 'button', price: 4500 },
  { id: 'btn_sunset', kind: 'button', price: 5500 },
  { id: 'btn_neon', kind: 'button', price: 7000 },
  { id: 'btn_royal', kind: 'button', price: 9000 },
];

/** Button styles: how answer buttons look. Same layout, different skin. */
export const BUTTON_STYLES: Record<string, { bg: string; text: string; badgeBg: string; badgeText: string; border?: string }> = {
  btn_classic: { bg: '#FFFFFF', text: '#0F172A', badgeBg: '#EEF2F7', badgeText: '#7C3AED' },
  btn_bubble: { bg: '#F5F3FF', text: '#4C1D95', badgeBg: '#7C3AED', badgeText: '#FFFFFF', border: '#DDD6FE' },
  btn_ink: { bg: '#0F172A', text: '#FFFFFF', badgeBg: '#334155', badgeText: '#C4B5FD' },
  btn_gold: { bg: '#FFFBEB', text: '#78350F', badgeBg: '#F59E0B', badgeText: '#FFFFFF', border: '#FCD34D' },
  btn_mint: { bg: '#ECFDF5', text: '#065F46', badgeBg: '#10B981', badgeText: '#FFFFFF', border: '#A7F3D0' },
  btn_candy: { bg: '#FDF2F8', text: '#9D174D', badgeBg: '#EC4899', badgeText: '#FFFFFF', border: '#FBCFE8' },
  btn_ocean: { bg: '#0369A1', text: '#FFFFFF', badgeBg: '#38BDF8', badgeText: '#0C4A6E' },
  btn_sunset: { bg: '#FFEDD5', text: '#9A3412', badgeBg: '#F97316', badgeText: '#FFFFFF', border: '#FDBA74' },
  btn_neon: { bg: '#18181B', text: '#A3E635', badgeBg: '#A3E635', badgeText: '#18181B', border: '#A3E635' },
  btn_royal: { bg: '#4C1D95', text: '#FDE68A', badgeBg: '#FBBF24', badgeText: '#4C1D95', border: '#FBBF24' },
};

export type Product = {
  id: string;
  kind: 'remove_ads' | 'starter' | 'coins';
  price: string;           // display fallback; the store's localised price replaces it
  usd: number;
  coins?: number;
  bonus?: number;          // percent, shown on the pack
  tag?: 'popular' | 'best';
};

export const PRODUCTS: Product[] = [
  { id: 'remove_ads', kind: 'remove_ads', price: '$3.99', usd: 3.99 },
  { id: 'starter_pack', kind: 'starter', price: '$1.99', usd: 1.99, coins: 2000 },
  { id: 'coins_s', kind: 'coins', price: '$1.99', usd: 1.99, coins: 3000, bonus: 0 },
  { id: 'coins_m', kind: 'coins', price: '$4.99', usd: 4.99, coins: 9000, bonus: 20, tag: 'popular' },
  { id: 'coins_l', kind: 'coins', price: '$9.99', usd: 9.99, coins: 20000, bonus: 35 },
  { id: 'coins_xl', kind: 'coins', price: '$19.99', usd: 19.99, coins: 45000, bonus: 50, tag: 'best' },
];

export const STARTER = { removeAdsDays: 7, coins: 2000, powerupsEach: 3, theme: 'neon', fromDay: 2 };
