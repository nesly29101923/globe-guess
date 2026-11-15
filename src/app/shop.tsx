// Shop: power-ups and items for coins, map themes and button styles (the long-term sink), coin packs and
// Remove Ads for money. Every price is shown up front; nothing is bought without a clear tap on its price.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { BUTTON_STYLES, COSMETICS, PRODUCTS, type Product } from '../config/cosmetics';
import { fx } from '../components/fx';
import { CoinPill, IconButton } from '../components/hud';
import { PopIn, Press, T } from '../components/ui';
import { haptic } from '../feedback/haptics';
import { play } from '../feedback/sfx';
import { fmt, t, upper } from '../i18n/strings';
import { buy, buyCosmetic, grantProduct, priceOf, starterAvailable, type ShopItem } from '../logic/economy';
import { analytics } from '../services/analytics';
import { purchases } from '../services/purchases';
import { useGame } from '../store/store';
import { colors, layout, mapThemes, radius, shadow } from '../theme';

const ITEMS: { id: ShopItem; icon: string; label: string; desc: string }[] = [
  { id: 'fiftyFifty', icon: '½', label: 'pu_fiftyFifty', desc: 'pu_fiftyFifty_desc' },
  { id: 'freeze', icon: '❄️', label: 'pu_freeze', desc: 'pu_freeze_desc' },
  { id: 'skip', icon: '⏭️', label: 'pu_skip', desc: 'pu_skip_desc' },
  { id: 'secondChance', icon: '🔁', label: 'pu_secondChance', desc: 'pu_secondChance_desc' },
  { id: 'streakFreeze', icon: '🧊', label: 'streak_freeze', desc: 'streak_freeze_desc' },
  { id: 'heartRefill', icon: '❤️', label: 'heart_refill', desc: 'hearts_other_modes' },
];

export default function ShopScreen() {
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const update = useGame((g) => g.update);
  const session = useGame((g) => g.session);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bump, setBump] = useState(0);
  const [prices, setPrices] = useState<Record<string, string>>({});
  useEffect(() => {
    analytics.log('shop_opened', {});
    purchases.products().then((ps) => setPrices(Object.fromEntries(ps.map((p) => [p.id, p.localizedPrice]))));
  }, []);
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(null), 1400);
  };

  const buyItem = (id: ShopItem) => {
    const r = buy(useGame.getState().save, id, useGame.getState().now());
    if (!r.ok) {
      haptic.error();
      return flash(r.reason === 'max' ? `${t('streak_freeze')} ${balance.daily.streakFreezeMax}/${balance.daily.streakFreezeMax}` : t('not_enough'));
    }
    update(() => r.state);
    play('powerup');
    haptic.success();
    setBump((b) => b + 1);
    analytics.log('coins_spent', { sink: id, amount: priceOf(id), balance: r.state.coins });
  };
  const buyTheme = (id: string) => {
    const s = useGame.getState().save;
    if (s.cosmetics.owned.includes(id)) {
      const c = COSMETICS.find((x) => x.id === id)!;
      update((x) => ({ ...x, cosmetics: { ...x.cosmetics, [c.kind === 'map' ? 'mapTheme' : 'buttonStyle']: id } }));
      play('tap');
      return;
    }
    const r = buyCosmetic(s, id);
    if (!r.ok) {
      haptic.error();
      return flash(t('not_enough'));
    }
    const c = COSMETICS.find((x) => x.id === id)!;
    update(() => ({ ...r.state, cosmetics: { ...r.state.cosmetics, [c.kind === 'map' ? 'mapTheme' : 'buttonStyle']: id } }));
    play('unlock');
    fx.confetti();
    analytics.log('coins_spent', { sink: `cosmetic_${id}`, amount: c.price ?? 0, balance: r.state.coins });
  };
  const buyProduct = async (p: Product) => {
    if (busy) return;
    setBusy(p.id);
    const r = await purchases.buy(p.id);
    setBusy(null);
    if (!r.ok) return;
    update((s) => grantProduct(s, p.id, useGame.getState().now()));
    play('chest');
    fx.confetti(true);
    if (p.coins) fx.coins({ x: SW / 2, y: 400 }, 10, { onLand: () => setBump((b) => b + 1) });
    flash(t('purchase_done'));
  };

  const starter = starterAvailable(save, useGame.getState().now(), session.firstSession);
  const coinPacks = PRODUCTS.filter((p) => p.kind === 'coins');
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="shop-back" />
        <T size={22} weight="black">{t('shop_title')}</T>
        <CoinPill value={save.coins} bumpKey={bump} />
      </View>
      <ScrollView contentContainerStyle={{ width: W, padding: 12, gap: 12, paddingBottom: insets.bottom + 30, alignSelf: 'center' }}>
        {starter ? (
          <PopIn style={[st.starter, shadow.card]}>
            <View style={st.rowBetween}>
              <T size={20} weight="black" color={colors.white}>{`🎁 ${t('starter_pack')}`}</T>
              <View style={st.tag}><T size={10} weight="black" color={colors.accent}>{upper(t('one_time'))}</T></View>
            </View>
            <T size={13} weight="semi" color={colors.white}>{t('starter_desc')}</T>
            <BuyButton label={prices.starter_pack ?? '$1.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'starter_pack')!)} busy={busy === 'starter_pack'} light testID="buy-starter" />
          </PopIn>
        ) : null}

        <Section title={t('shop_powerups')}>
          {ITEMS.map((it) => {
            const owned = it.id === 'streakFreeze' ? `${save.streak.freezes}/${balance.daily.streakFreezeMax}` : it.id === 'heartRefill' ? '' : `×${save.powerups[it.id as keyof typeof save.powerups]}`;
            return (
              <View key={it.id} style={st.itemRow}>
                <View style={st.itemIcon}><T size={22}>{it.icon}</T></View>
                <View style={{ flex: 1 }}>
                  <T size={14} weight="black">{`${t(it.label as never)} ${owned}`}</T>
                  <T size={11} weight="semi" color={colors.inkSoft}>{t(it.desc as never, { n: balance.daily.streakFreezeMax })}</T>
                </View>
                <CoinButton price={priceOf(it.id)} affordable={save.coins >= priceOf(it.id)} onPress={() => buyItem(it.id)} testID={`buy-${it.id}`} />
              </View>
            );
          })}
        </Section>

        <Section title={t('shop_themes')}>
          <View style={st.themes}>
            {COSMETICS.filter((c) => c.kind === 'map').map((c) => {
              const th = mapThemes[c.theme ?? 'classic'];
              const owned = save.cosmetics.owned.includes(c.id);
              const inUse = save.cosmetics.mapTheme === c.id;
              return (
                <Press key={c.id} onPress={() => (owned || c.price != null) && buyTheme(c.id)} disabled={!owned && c.price == null} style={st.themeCell} testID={`theme-${c.id}`}>
                  <View style={[st.theme, inUse && st.inUse, shadow.soft]}>
                    <View style={[st.swatch, { backgroundColor: th.seaTop }]}>
                      <View style={[st.land, { backgroundColor: th.land, borderColor: th.landEdge }]} />
                      <View style={[st.target, { backgroundColor: th.target }]} />
                    </View>
                    <T size={12} weight="black">{t(`theme_${c.id}` as never)}</T>
                    <T size={11} weight="bold" color={inUse ? colors.correct : owned ? colors.accent : colors.goldDark}>
                      {inUse ? t('equipped') : owned ? t('equip') : c.price == null ? t('starter_only') : `🪙 ${fmt(c.price)}`}
                    </T>
                  </View>
                </Press>
              );
            })}
          </View>
        </Section>

        <Section title={t('shop_buttons')}>
          <View style={st.themes}>
            {COSMETICS.filter((c) => c.kind === 'button').map((c) => {
              const b = BUTTON_STYLES[c.id];
              const owned = save.cosmetics.owned.includes(c.id);
              const inUse = save.cosmetics.buttonStyle === c.id;
              return (
                <Press key={c.id} onPress={() => buyTheme(c.id)} style={st.themeCell} testID={`btn-${c.id}`}>
                  <View style={[st.theme, inUse && st.inUse, shadow.soft]}>
                    <View style={[st.btnPreview, { backgroundColor: b.bg, borderColor: b.border ?? 'transparent' }]}>
                      <View style={[st.badge, { backgroundColor: b.badgeBg }]}><T size={10} weight="black" color={b.badgeText}>A</T></View>
                      <T size={11} weight="bold" color={b.text}>FRANCE</T>
                    </View>
                    <T size={12} weight="black">{t(c.id as never)}</T>
                    <T size={11} weight="bold" color={inUse ? colors.correct : owned ? colors.accent : colors.goldDark}>{inUse ? t('equipped') : owned ? t('equip') : `🪙 ${fmt(c.price ?? 0)}`}</T>
                  </View>
                </Press>
              );
            })}
          </View>
        </Section>

        <Section title={t('shop_coins')}>
          {coinPacks.map((p) => (
            <View key={p.id} style={st.itemRow}>
              <View style={st.itemIcon}><T size={22}>{p.id === 'coins_xl' ? '💰' : p.id === 'coins_l' ? '🏦' : '🪙'}</T></View>
              <View style={{ flex: 1 }}>
                <T size={15} weight="black">{fmt(p.coins ?? 0)}</T>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {p.bonus ? <T size={11} weight="black" color={colors.correct}>{t('bonus', { n: p.bonus })}</T> : null}
                  {p.tag ? <T size={11} weight="black" color={colors.accent}>{p.tag === 'popular' ? t('most_popular') : t('best_value')}</T> : null}
                </View>
              </View>
              <BuyButton label={prices[p.id] ?? p.price} onPress={() => buyProduct(p)} busy={busy === p.id} testID={`buy-${p.id}`} />
            </View>
          ))}
          {!save.ads.removed ? (
            <View style={st.itemRow}>
              <View style={st.itemIcon}><T size={22}>🚫</T></View>
              <View style={{ flex: 1 }}>
                <T size={15} weight="black">{t('remove_ads')}</T>
                <T size={11} weight="semi" color={colors.inkSoft}>{t('remove_ads_desc')}</T>
              </View>
              <BuyButton label={prices.remove_ads ?? '$3.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'remove_ads')!)} busy={busy === 'remove_ads'} testID="buy-remove-ads" />
            </View>
          ) : null}
        </Section>
      </ScrollView>
      {msg ? (
        <View style={st.toastWrap} pointerEvents="none"><PopIn style={[st.toast, shadow.card]}><T size={14} weight="black" color={colors.white}>{msg}</T></PopIn></View>
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PopIn style={[st.section, shadow.soft]}>
      <T size={16} weight="black">{title}</T>
      {children}
    </PopIn>
  );
}

function CoinButton({ price, affordable, onPress, testID }: { price: number; affordable: boolean; onPress: () => void; testID?: string }) {
  return (
    <Press onPress={onPress} testID={testID} sound={affordable ? 'coin_0' : 'tap'}>
      <View style={[st.buy, { backgroundColor: affordable ? colors.gold : colors.chip }]}>
        <View style={st.coin} />
        <T size={14} weight="black" color={affordable ? colors.white : colors.inkSoft}>{fmt(price)}</T>
      </View>
    </Press>
  );
}

function BuyButton({ label, onPress, busy, light, testID }: { label: string; onPress: () => void; busy?: boolean; light?: boolean; testID?: string }) {
  return (
    <Press onPress={onPress} disabled={busy} testID={testID}>
      <View style={[st.buy, { backgroundColor: light ? colors.white : colors.correct, minWidth: 86 }]}>
        <T size={14} weight="black" color={light ? colors.accent : colors.white}>{busy ? '…' : label}</T>
      </View>
    </Press>
  );
}

const st = StyleSheet.create({
  bg: { backgroundColor: '#C9E2F6', alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starter: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: 16, gap: 8 },
  tag: { backgroundColor: colors.white, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  section: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 14, gap: 10 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemIcon: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 12, height: 44, justifyContent: 'center' },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FCD34D', borderWidth: 2, borderColor: colors.white },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeCell: { width: '31%', flexGrow: 1 },
  theme: { backgroundColor: colors.white, borderRadius: radius.md, padding: 8, alignItems: 'center', gap: 4, borderWidth: 3, borderColor: colors.chip },
  inUse: { borderColor: colors.correct },
  swatch: { width: '100%', height: 54, borderRadius: 10, overflow: 'hidden' },
  land: { position: 'absolute', left: 10, top: 10, width: 46, height: 30, borderRadius: 8, borderWidth: 1.5 },
  target: { position: 'absolute', left: 30, top: 18, width: 16, height: 14, borderRadius: 4 },
  btnPreview: { width: '100%', height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderWidth: 2 },
  badge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  toast: { backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
});
