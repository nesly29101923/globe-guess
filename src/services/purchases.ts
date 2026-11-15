// Purchases behind one interface (RevenueCat in production). The fake grants after a short delay.
import { PRODUCTS, type Product } from '../config/cosmetics';
import { analytics } from './analytics';

export type PurchaseResult = { ok: boolean; productId: string; cancelled?: boolean };

export interface PurchasesProvider {
  init(): Promise<void>;
  products(): Promise<(Product & { localizedPrice: string })[]>;
  buy(productId: string): Promise<PurchaseResult>;
  restore(): Promise<string[]>;   // non-consumable product ids owned
}

class FakePurchases implements PurchasesProvider {
  owned = new Set<string>();
  async init() {}
  async products() {
    return PRODUCTS.map((p) => ({ ...p, localizedPrice: p.price }));
  }
  async buy(productId: string) {
    await new Promise((r) => setTimeout(r, 600));
    if (productId === 'remove_ads') this.owned.add(productId);
    return { ok: true, productId };
  }
  async restore() {
    return [...this.owned];
  }
}

let provider: PurchasesProvider = new FakePurchases();
export function setPurchasesProvider(p: PurchasesProvider) {
  provider = p;
}

export const purchases = {
  init: () => provider.init(),
  products: () => provider.products(),
  async buy(productId: string): Promise<PurchaseResult> {
    const p = PRODUCTS.find((x) => x.id === productId);
    analytics.log('purchase_started', { product: productId, price: p?.usd });
    const r = await provider.buy(productId);
    if (r.ok) analytics.log('purchase_completed', { product: productId, price: p?.usd });
    return r;
  },
  restore: () => provider.restore(),
};
