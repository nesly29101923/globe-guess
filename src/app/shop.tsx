// Shop: power-ups and items for coins, map themes and button styles (the long-term sink), coin packs and
// Remove Ads for money. Every price is shown up front; nothing is bought without a clear tap on its price.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { BUTTON_STYLES, COSMETICS, PRODUCTS, STARTER, type Product } from '../config/cosmetics';
import { fx } from '../components/fx';
import { CoinPill, ScreenHeader } from '../components/hud';
import { Coin, Icon, type IconName } from '../components/Icon';
import { Dot, PopIn, Press, T } from '../components/ui';
import { haptic } from '../feedback/haptics';
import { play } from '../feedback/sfx';
import { fmt, t, upper } from '../i18n/strings';
import { buy, buyCosmetic, freeCoinsLeft, grantFreeCoins, grantProduct, priceOf, starterAvailable, type ShopItem } from '../logic/economy';
import { ads } from '../services/ads';
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
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'items');
  const today = useGame.getState().today();
  const freeLeft = freeCoinsLeft(save, today);
  const onFreeCoins = async () => {
    const ok = await ads.rewarded('free_coins');
    if (!ok) return;
    update((s) => grantFreeCoins(s, today));
    analytics.log('coins_earned', { source: 'ad_free', amount: balance.ads.rewardedFreeCoins, balance: useGame.getState().save.coins });
    fx.coins({ x: SW / 2, y: 300 }, 8, { onLand: () => setBump((b) => b + 1) });
  };
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
          <View style={st.grid}>
            {ITEMS.map((it, i) => {
              const owned = it.id === 'streakFreeze' ? `${save.streak.freezes}/${balance.daily.streakFreezeMax}` : it.id === 'heartRefill' ? '' : `×${save.powerups[it.id as keyof typeof save.powerups]}`;
              return (
                <PopIn key={it.id} delay={i * 30} style={st.cell}>
                  <View style={[st.card, shadow.soft]}>
                    {owned ? <View style={st.ownedTag}><T size={type.label} weight="black" color={colors.white}>{owned}</T></View> : null}
                    <View style={[st.bigIcon, { backgroundColor: it.color }]}><Icon name={it.icon} size={34} color="#FFFFFF" /></View>
                    <T size={type.body} weight="black" center lines={1}>{t(it.label as never)}</T>
                    <T size={type.caption} weight="semi" color={colors.inkSoft} center lines={2} style={{ minHeight: 28 }}>{t(it.desc as never, { n: balance.daily.streakFreezeMax })}</T>
                    <CoinButton price={priceOf(it.id)} affordable={save.coins >= priceOf(it.id)} onPress={() => buyItem(it.id)} testID={`buy-${it.id}`} />
                  </View>
                </PopIn>
              );
            })}
          </View>
        ) : null}

        {tab === 'maps' ? (
          <View style={st.themes}>
            {COSMETICS.filter((c) => c.kind === 'map').map((c) => {
              const th = mapThemes[c.theme ?? 'classic'];
              const owned = save.cosmetics.owned.includes(c.id);
              const inUse = save.cosmetics.mapTheme === c.id;
              return (
                <Press key={c.id} onPress={() => (owned || c.price != null) && buyTheme(c.id)} disabled={!owned && c.price == null} style={st.themeCell} testID={`theme-${c.id}`}>
                  <View style={[st.theme, inUse && st.inUse]}>
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
                  <View style={[st.theme, inUse && st.inUse]}>
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
                  <View style={st.inline}><Icon name="gift" size={26} color={colors.white} /><T size={type.title} weight="black" color={colors.white}>{t('starter_pack')}</T></View>
                  <View style={st.tag}><T size={type.caption} weight="black" color={colors.accent}>{upper(t('one_time'))}</T></View>
                </View>
                {/* what is inside, as things you can see */}
                <View style={st.contents}>
                  <Content icon={<Coin size={30} />} label={fmt(STARTER.coins)} />
                  <Content icon={<Icon name="circle-half-full" size={30} color="#8B5CF6" />} label={`×${STARTER.powerupsEach}`} />
                  <Content icon={<Icon name="snowflake" size={30} color="#0EA5E9" />} label={`×${STARTER.powerupsEach}`} />
                  <Content icon={<Icon name="skip-next" size={30} color="#F59E0B" />} label={`×${STARTER.powerupsEach}`} />
                  <Content icon={<View style={[st.miniMap, { backgroundColor: mapThemes.neon.seaTop }]}><View style={[st.miniLand, { backgroundColor: mapThemes.neon.land }]} /></View>} label={t('theme_neon')} />
                  <Content icon={<Icon name="cancel" size={30} color={colors.wrong} />} label={t('no_ads_days', { n: STARTER.removeAdsDays })} />
                </View>
                <BuyButton label={prices.starter_pack ?? '$1.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'starter_pack')!)} busy={busy === 'starter_pack'} light testID="buy-starter" />
              </PopIn>
            ) : null}
            <View style={st.grid}>
              {!session.firstSession ? (
                <View style={st.cell}>
                  <View style={[st.card, st.freeCard, shadow.soft]}>
                    <View style={st.art}><Icon name="play-circle" size={52} color={colors.gold} /></View>
                    <View style={st.inline}><Coin size={18} /><T size={type.title} weight="black">{`+${balance.ads.rewardedFreeCoins}`}</T></View>
                    <T size={type.caption} weight="bold" color={colors.inkSoft}>{freeLeft > 0 ? t('free_coins_left', { n: freeLeft, max: balance.ads.rewardedFreeCoinsPerDay }) : t('free_coins_none')}</T>
                    <Press onPress={onFreeCoins} disabled={freeLeft <= 0 || !ads.rewardedReady()} testID="shop-free-coins" style={{ alignSelf: 'stretch' }}>
                      <View style={[st.buy, { backgroundColor: freeLeft > 0 && ads.rewardedReady() ? colors.gold : colors.chip }]}>
                        <Icon name="play" size={18} color={freeLeft > 0 && ads.rewardedReady() ? colors.white : colors.inkSoft} />
                        <T size={type.body} weight="black" color={freeLeft > 0 && ads.rewardedReady() ? colors.white : colors.inkSoft}>{t('free_short')}</T>
                      </View>
                    </Press>
                  </View>
                </View>
              ) : null}
              {coinPacks.map((p, i) => (
                <PopIn key={p.id} delay={i * 40} style={st.cell}>
                  <View style={[st.card, shadow.soft, p.tag === 'best' && st.bestCard]}>
                    {p.tag ? <View style={[st.ribbon, { backgroundColor: p.tag === 'best' ? colors.flame : colors.accent }]}><T size={type.caption} weight="black" color={colors.white}>{p.tag === 'best' ? t('best_tag') : t('popular_tag')}</T></View> : null}
                    <View style={st.art}><CoinArt tier={i + 1} /></View>
                    <View style={st.inline}><Coin size={18} /><T size={type.title} weight="black">{fmt(p.coins ?? 0)}</T></View>
                    <T size={type.caption} weight="black" color={colors.correct} style={{ opacity: p.bonus ? 1 : 0 }}>{t('bonus', { n: p.bonus ?? 0 })}</T>
                    <BuyButton label={prices[p.id] ?? p.price} onPress={() => buyProduct(p)} busy={busy === p.id} testID={`buy-${p.id}`} />
                  </View>
                </PopIn>
              ))}
            </View>
            {!save.ads.removed ? (
              <View style={[st.section, shadow.soft]}>
                <View style={st.itemRow}>
                  <View style={[st.bigIcon, { backgroundColor: colors.wrong, width: 52, height: 52 }]}><Icon name="cancel" size={28} color="#FFFFFF" /></View>
                  <T size={type.heading} weight="black" style={{ flex: 1 }}>{t('remove_ads')}</T>
                  <BuyButton label={prices.remove_ads ?? '$3.99'} onPress={() => buyProduct(PRODUCTS.find((x) => x.id === 'remove_ads')!)} busy={busy === 'remove_ads'} testID="buy-remove-ads" />
                </View>
              </View>
            ) : null}
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

function Content({ icon, label }: { icon: React.ReactNode; label: string }) {
  const st = useStyles(make_st);
  return (
    <View style={st.content}>
      <View style={st.contentIcon}>{icon}</View>
      <T size={type.caption} weight="black" color="#FFFFFF" lines={1}>{label}</T>
    </View>
  );
}

/** Coin pack art that grows with the pack: one coin, a stack, a pile, a sack, a chest full. */
function CoinArt({ tier }: { tier: number }) {
  const colors = usePalette();
  const coin = (x: number, y: number, s: number, k: number) => <Coin key={k} size={s} style={{ position: 'absolute', left: x, top: y }} />;
  if (tier <= 1) return <View style={{ width: 64, height: 64 }}>{coin(14, 14, 36, 0)}</View>;
  if (tier === 2) return <View style={{ width: 64, height: 64 }}>{[[4, 26], [26, 26], [15, 8]].map(([x, y], k) => coin(x, y, 32, k))}</View>;
  if (tier === 3) {
    return (
      <View style={{ width: 72, height: 64 }}>
        <Icon name="sack" size={62} color={colors.goldDark} style={{ position: 'absolute', left: 5, top: 0 }} />
        {[[0, 38], [44, 40], [22, 44]].map(([x, y], k) => coin(x, y, 24, k))}
      </View>
    );
  }
  return (
    <View style={{ width: 80, height: 64 }}>
      <Icon name="treasure-chest" size={68} color="#B45309" style={{ position: 'absolute', left: 6, top: -2 }} />
      {[[0, 40], [56, 38], [20, 46], [38, 46], [28, 2], [10, 10], [48, 8]].slice(0, tier === 4 ? 4 : 7).map(([x, y], k) => coin(x, y, 22, k))}
    </View>
  );
}

function CoinButton({ price, affordable, onPress, testID }: { price: number; affordable: boolean; onPress: () => void; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID} sound={affordable ? 'coin_0' : 'tap'} style={{ alignSelf: 'stretch' }}>
      <View style={[st.buy, st.buyWide, { backgroundColor: affordable ? colors.gold : colors.chip }]}>
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
    <Press onPress={onPress} disabled={busy} testID={testID} style={{ alignSelf: 'stretch' }}>
      <View style={[st.buy, { backgroundColor: light ? colors.white : colors.correct, minWidth: 96 }]}>
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
  ownedTag: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.ink, borderRadius: 99, paddingHorizontal: 8, height: 24, justifyContent: 'center', zIndex: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cell: { width: '48%', flexGrow: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 12, alignItems: 'center', gap: 6 },
  bestCard: { borderWidth: 3, borderColor: colors.flame },
  freeCard: { backgroundColor: colors.goldSoft },
  bigIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 4, borderBottomColor: 'rgba(15,23,42,0.22)' },
  art: { height: 68, alignItems: 'center', justifyContent: 'center' },
  ribbon: { position: 'absolute', top: -10, borderRadius: 99, paddingHorizontal: 10, height: 22, justifyContent: 'center', zIndex: 2 },
  buyWide: { alignSelf: 'stretch' },
  contents: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  content: { width: '31%', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, paddingVertical: 8 },
  contentIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  miniMap: { width: 30, height: 22, borderRadius: 5, overflow: 'hidden' },
  miniLand: { position: 'absolute', left: 5, top: 5, width: 16, height: 10, borderRadius: 3 },
  btnCell: { width: '48%', flexGrow: 1 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starter: { backgroundColor: colors.accent, borderRadius: radius.xl, padding: 14, gap: 12 },
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
