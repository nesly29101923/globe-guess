// Shop: power-ups and items for coins, map themes and button styles (the long-term sink), coin packs and
// Remove Ads for money. Every price is shown up front; nothing is bought without a clear tap on its price.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { BUTTON_STYLES, COSMETICS, PRODUCTS, type Product } from '../config/cosmetics';
import { fx } from '../components/fx';
import { CoinPill, ScreenHeader } from '../components/hud';
import { Coin, Icon, type IconName } from '../components/Icon';
import { Dot, PopIn, Press, T } from '../components/ui';
import { haptic } from '../feedback/haptics';
import { play } from '../feedback/sfx';
import { fmt, t, upper } from '../i18n/strings';
import { buy, buyCosmetic, grantProduct, priceOf, starterAvailable, type ShopItem } from '../logic/economy';
import { analytics } from '../services/analytics';
import { purchases } from '../services/purchases';
import { useGame } from '../store/store';
import { layout, mapThemes, radius, shadow, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

/** Level that gives a cosmetic as a reward. */
function levelOf(id: string): number {
  const e = Object.entries(balance.levelRewards).find(([, r]) => r.cosmetic === id);
  return e ? Number(e[0]) : 0;
}

type Tab = 'items' | 'maps' | 'buttons' | 'coins';

const ITEMS: { id: ShopItem; icon: IconName; color: string; label: string; desc: string }[] = [
  { id: 'fiftyFifty', icon: 'circle-half-full', color: '#7C3AED', label: 'pu_fiftyFifty', desc: 'pu_fiftyFifty_desc' },
  { id: 'freeze', icon: 'snowflake', color: '#0EA5E9', label: 'pu_freeze', desc: 'pu_freeze_desc' },
  { id: 'skip', icon: 'skip-next', color: '#7C3AED', label: 'pu_skip', desc: 'pu_skip_desc' },
  { id: 'secondChance', icon: 'backup-restore', color: '#16A34A', label: 'pu_secondChance', desc: 'pu_secondChance_desc' },
  { id: 'streakFreeze', icon: 'snowflake', color: '#F97316', label: 'streak_freeze', desc: 'streak_freeze_desc' },
  { id: 'heartRefill', icon: 'heart-plus', color: '#EF4444', label: 'heart_refill', desc: 'hearts_other_modes' },
];

export default function ShopScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
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
  const [tab, setTab] = useState<Tab>('items');
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
  const TABS: { id: Tab; icon: IconName; label: string }[] = [
    { id: 'items', icon: 'lightning-bolt', label: t('shop_powerups') },
    { id: 'maps', icon: 'map', label: t('shop_maps_short') },
    { id: 'buttons', icon: 'gesture-tap-button', label: t('shop_buttons_short') },
    { id: 'coins', icon: 'sack', label: t('shop_coins_short') },
  ];
  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <ScreenHeader title={t('shop_title')} onBack={() => router.back()} testID="shop-back" right={<CoinPill value={save.coins} bumpKey={bump} />} />
      </View>
      {/* tabs: each fits on one screen instead of one long list */}
      <View style={[st.tabs, { width: W - 24 }]}>
        {TABS.map((x) => (
          <Press key={x.id} onPress={() => setTab(x.id)} style={{ flex: 1 }} testID={`tab-${x.id}`} scaleTo={0.95}>
            <View style={[st.tab, tab === x.id && st.tabOn]}>
              <Icon name={x.icon} size={20} color={tab === x.id ? colors.white : colors.accent} />
              <T size={type.caption} weight="black" color={tab === x.id ? colors.white : colors.ink} lines={1}>{x.label}</T>
              {x.id === 'coins' && starter && tab !== 'coins' ? <Dot /> : null}
            </View>
          </Press>
        ))}
      </View>
      <ScrollView style={{ flex: 1, width: W }} contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: insets.bottom + 24 }} showsVerticalScrollIndicator={false}>
        {tab === 'items' ? (
          <Section>
            {ITEMS.map((it) => {
              const owned = it.id === 'streakFreeze' ? `${save.streak.freezes}/${balance.daily.streakFreezeMax}` : it.id === 'heartRefill' ? '' : `×${save.powerups[it.id as keyof typeof save.powerups]}`;
              return (
                <View key={it.id} style={st.itemRow}>
                  <View style={st.itemIcon}><Icon name={it.icon} size={26} color={it.color} /></View>
                  <View style={{ flex: 1 }}>
                    <View style={st.inline}>
                      <T size={type.body} weight="black">{t(it.label as never)}</T>
                      {owned ? <View style={st.ownedTag}><T size={type.caption} weight="black" color={colors.accent}>{owned}</T></View> : null}
                    </View>
                    <T size={type.caption} weight="semi" color={colors.inkSoft} lines={2}>{t(it.desc as never, { n: balance.daily.streakFreezeMax })}</T>
                  </View>
                  <CoinButton price={priceOf(it.id)} affordable={save.coins >= priceOf(it.id)} onPress={() => buyItem(it.id)} testID={`buy-${it.id}`} />
                </View>
              );
            })}
          </Section>
        ) : null}

        {tab === 'maps' ? (
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
                    <T size={type.label} weight="black">{t(`theme_${c.id}` as never)}</T>
                    <PriceTag inUse={inUse} owned={owned} price={c.price} lockText={c.source === 'level' ? t('level_reached', { n: levelOf(c.id) }) : t('starter_only')} />
                  </View>
                </Press>
              );
            })}
          </View>
        ) : null}

        {tab === 'buttons' ? (
          <View style={st.themes}>
            {COSMETICS.filter((c) => c.kind === 'button').map((c) => {
              const b = BUTTON_STYLES[c.id];
              const owned = save.cosmetics.owned.includes(c.id);
              const inUse = save.cosmetics.buttonStyle === c.id;
              return (
                <Press key={c.id} onPress={() => (owned || c.price != null) && buyTheme(c.id)} disabled={!owned && c.price == null} style={st.btnCell} testID={`btn-${c.id}`}>
                  <View style={[st.theme, inUse && st.inUse, shadow.soft]}>
                    <View style={[st.btnPreview, { backgroundColor: b.bg, borderColor: b.border ?? 'transparent' }]}>
                      <View style={[st.badge, { backgroundColor: b.badgeBg }]}><T size={type.caption} weight="black" color={b.badgeText}>A</T></View>
                      <T size={type.label} weight="bold" color={b.text}>FRANCE</T>
                    </View>
                    <T size={type.label} weight="black">{t(c.id as never)}</T>
                    <PriceTag inUse={inUse} owned={owned} price={c.price} lockText={t('level_reached', { n: levelOf(c.id) })} />
                  </View>
                </Press>
              );
            })}
          </View>
        ) : null}

        {tab === 'coins' ? (
          <>
            {starter ? (
              <PopIn style={[st.starter, shadow.card]}>
                <View style={st.rowBetween}>
                  <View style={st.inline}><Icon name="gift" size={24} color={colors.white} /><T size={type.title} weight="black" color={colors.white}>{t('starter_pack')}</T></View>
                  <View style={st.tag}><T size={type.caption} weight="black" color={colors.accent}>{upper(t('one_time'))}</T></View>
                </View>
                <T size={type.label} weight="semi" color={colors.white}>{t('starter_desc')}</T>
                <BuyButton label={prices.starter_pack ?? '$1.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'starter_pack')!)} busy={busy === 'starter_pack'} light testID="buy-starter" />
              </PopIn>
            ) : null}
            <Section>
              {coinPacks.map((p, i) => (
                <View key={p.id} style={st.itemRow}>
                  <View style={[st.itemIcon, { backgroundColor: colors.goldSoft }]}>
                    {i === 0 ? <Coin size={26} /> : <Icon name={p.id === 'coins_xl' ? 'treasure-chest' : p.id === 'coins_l' ? 'sack' : 'cash-multiple'} size={28} color={colors.goldDark} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={st.inline}><Coin size={16} /><T size={type.heading} weight="black">{fmt(p.coins ?? 0)}</T></View>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {p.bonus ? <T size={type.caption} weight="black" color={colors.correct}>{t('bonus', { n: p.bonus })}</T> : null}
                      {p.tag ? <T size={type.caption} weight="black" color={colors.accent}>{p.tag === 'popular' ? t('most_popular') : t('best_value')}</T> : null}
                    </View>
                  </View>
                  <BuyButton label={prices[p.id] ?? p.price} onPress={() => buyProduct(p)} busy={busy === p.id} testID={`buy-${p.id}`} />
                </View>
              ))}
              {!save.ads.removed ? (
                <View style={st.itemRow}>
                  <View style={st.itemIcon}><Icon name="cancel" size={26} color={colors.wrong} /></View>
                  <View style={{ flex: 1 }}>
                    <T size={type.body} weight="black">{t('remove_ads')}</T>
                    <T size={type.caption} weight="semi" color={colors.inkSoft} lines={2}>{t('remove_ads_desc')}</T>
                  </View>
                  <BuyButton label={prices.remove_ads ?? '$3.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'remove_ads')!)} busy={busy === 'remove_ads'} testID="buy-remove-ads" />
                </View>
              ) : null}
            </Section>
          </>
        ) : null}
      </ScrollView>
      {msg ? (
        <View style={st.toastWrap} pointerEvents="none"><PopIn style={[st.toast, shadow.card]}><T size={type.body} weight="black" color={colors.white}>{msg}</T></PopIn></View>
      ) : null}
    </View>
  );
}

function PriceTag({ inUse, owned, price, lockText }: { inUse: boolean; owned: boolean; price: number | null | undefined; lockText: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  if (inUse) return <View style={st.inline}><Icon name="check-circle" size={14} color={colors.correct} /><T size={type.caption} weight="black" color={colors.correct}>{t('equipped')}</T></View>;
  if (owned) return <T size={type.caption} weight="black" color={colors.accent}>{t('equip')}</T>;
  if (price == null) return <View style={st.inline}><Icon name="lock" size={12} color={colors.inkSoft} /><T size={type.caption} weight="bold" color={colors.inkSoft} lines={1}>{lockText}</T></View>;
  return <View style={st.inline}><Coin size={14} /><T size={type.caption} weight="black" color={colors.goldDark}>{fmt(price)}</T></View>;
}

function Section({ children }: { children: React.ReactNode }) {
  const st = useStyles(make_st);
  return <PopIn style={[st.section, shadow.soft]}>{children}</PopIn>;
}

function CoinButton({ price, affordable, onPress, testID }: { price: number; affordable: boolean; onPress: () => void; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID} sound={affordable ? 'coin_0' : 'tap'}>
      <View style={[st.buy, { backgroundColor: affordable ? colors.gold : colors.chip }]}>
        <Coin size={18} />
        <T size={type.body} weight="black" color={affordable ? colors.white : colors.inkSoft}>{fmt(price)}</T>
      </View>
    </Press>
  );
}

function BuyButton({ label, onPress, busy, light, testID }: { label: string; onPress: () => void; busy?: boolean; light?: boolean; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} disabled={busy} testID={testID}>
      <View style={[st.buy, { backgroundColor: light ? colors.white : colors.correct, minWidth: 86 }]}>
        <T size={type.body} weight="black" color={light ? colors.accent : colors.white}>{busy ? '…' : label}</T>
      </View>
    </Press>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { paddingHorizontal: 12, paddingBottom: 10 },
  tabs: { flexDirection: 'row', gap: 6, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 4 },
  tab: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabOn: { backgroundColor: colors.accent },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ownedTag: { backgroundColor: colors.accentSoft, borderRadius: 99, paddingHorizontal: 7, height: 20, justifyContent: 'center' },
  btnCell: { width: '48%', flexGrow: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starter: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: 16, gap: 8 },
  tag: { backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  section: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, gap: 14 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50 },
  itemIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  buy: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.md, paddingHorizontal: 12, height: 44, minWidth: 86, justifyContent: 'center' },
  themes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  themeCell: { width: '48%', flexGrow: 1 },
  theme: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 8, alignItems: 'center', gap: 4, borderWidth: 3, borderColor: colors.chip },
  inUse: { borderColor: colors.correct },
  swatch: { width: '100%', height: 54, borderRadius: 10, overflow: 'hidden' },
  land: { position: 'absolute', left: 10, top: 10, width: 46, height: 30, borderRadius: 8, borderWidth: 1.5 },
  target: { position: 'absolute', left: 30, top: 18, width: 16, height: 14, borderRadius: 4 },
  btnPreview: { width: '100%', height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6, borderWidth: 2 },
  badge: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  toast: { backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 18, paddingVertical: 10 },
});
