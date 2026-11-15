// The Journey: a winding path of levels across chapters. The next goal (and the chest ahead) is always in view.
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { CHAPTERS, LEVELS, type LevelDef } from '../config/levels';
import { CoinPill, HeartsPill, IconButton } from '../components/hud';
import { BigButton, PopIn, Press, SmallButton, T } from '../components/ui';
import { fmtTime, t } from '../i18n/strings';
import { buy } from '../logic/economy';
import { chapterLock, chapterStars, currentLevel, heartsNow, isLevelOpen, refillHearts, totalStars } from '../logic/journey';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { colors, layout, radius, shadow, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

const NODE = 66;
const ROW = 92;

export default function JourneyScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const update = useGame((g) => g.update);
  const [, setTick] = useState(0);
  const [heartsSheet, setHeartsSheet] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const now = useGame.getState().now();
  const hearts = heartsNow(save, now);
  const cur = currentLevel(save);
  useEffect(() => {
    const h = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(h);
  }, []);

  // position of every node on the winding path
  const xs = [0.5, 0.72, 0.8, 0.66, 0.42, 0.24, 0.2, 0.34, 0.58, 0.5];
  let y = 0;
  const items: ({ kind: 'chapter'; ci: number; y: number } | { kind: 'level'; l: LevelDef; x: number; y: number })[] = [];
  CHAPTERS.forEach((c, ci) => {
    items.push({ kind: 'chapter', ci, y });
    y += 96;
    LEVELS.filter((l) => l.chapter === c.id).forEach((l, i) => {
      items.push({ kind: 'level', l, x: xs[i % xs.length] * (W - NODE) , y });
      y += ROW;
    });
    y += 24;
  });
  const curItem = items.find((i) => i.kind === 'level' && i.l.id === cur.id);
  useEffect(() => {
    const h = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, (curItem?.y ?? 0) - 260), animated: true }), 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = (l: LevelDef) => {
    if (!isLevelOpen(save, l)) return;
    if (balance.hearts.enabled && heartsNow(useGame.getState().save, useGame.getState().now()).count <= 0) return setHeartsSheet(true);
    router.push({ pathname: '/play', params: { mode: 'journey', level: l.id, nonce: String(Date.now()) } });
  };

  const refillCoins = () => {
    const r = buy(useGame.getState().save, 'heartRefill', useGame.getState().now());
    if (r.ok) {
      update(() => r.state);
      analytics.log('coins_spent', { sink: 'heart_refill', amount: balance.prices.heartRefill, balance: r.state.coins });
      setHeartsSheet(false);
    }
  };
  const refillAd = async () => {
    const ok = await ads.rewarded('extra_heart');
    if (ok) {
      update((s) => refillHearts(s, useGame.getState().now(), 1));
      setHeartsSheet(false);
    }
  };

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <IconButton icon="←" onPress={() => router.back()} testID="journey-back" />
        <View style={st.starsPill}><T size={16} weight="black" color={colors.gold}>★</T><T size={16} weight="black">{String(totalStars(save))}</T></View>
        <HeartsPill count={hearts.count} max={balance.hearts.max} nextIn={hearts.nextInMs ? fmtTime(hearts.nextInMs) : null} onPress={() => setHeartsSheet(true)} />
        <CoinPill value={save.coins} onPress={() => router.push('/shop')} />
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ width: W, height: y + insets.bottom + 40, alignSelf: 'center' }}>
        {/* path line */}
        {items.map((it, i) => {
          if (it.kind !== 'level') return null;
          const nx = items[i + 1];
          if (!nx || nx.kind !== 'level') return null;
          const done = (save.journey.stars[it.l.id] ?? 0) > 0;
          return <Segment key={`s${i}`} x1={it.x + NODE / 2} y1={it.y + NODE / 2} x2={nx.x + NODE / 2} y2={nx.y + NODE / 2} done={done} />;
        })}
        {items.map((it) => {
          if (it.kind === 'chapter') {
            const c = CHAPTERS[it.ci];
            const lock = chapterLock(save, it.ci);
            const cs = chapterStars(save, c.id);
            return (
              <View key={c.id} style={[st.chapter, shadow.soft, { top: it.y + 12, width: W - 24 }, !lock.open && st.lockedCard]}>
                <T size={26}>{lock.open ? c.icon : '🔒'}</T>
                <View style={{ flex: 1 }}>
                  <T size={11} weight="bold" color={colors.inkSoft}>{t('chapter', { n: it.ci + 1 })}</T>
                  <T size={17} weight="black">{t(`chapter_${c.id}` as never)}</T>
                </View>
                {lock.open ? <T size={13} weight="black" color={colors.gold}>{`★ ${cs.have}/${cs.max}`}</T> : (
                  <T size={11} weight="bold" color={colors.accent}>{lock.needBoss ? t('locked_boss') : t('locked_stars', { n: c.starsToOpen })}</T>
                )}
              </View>
            );
          }
          const l = it.l;
          const stars = save.journey.stars[l.id] ?? 0;
          const open = isLevelOpen(save, l);
          const isCur = l.id === cur.id;
          return (
            <View key={l.id} style={[st.nodeWrap, { left: it.x, top: it.y }]}>
              <Node level={l} stars={stars} open={open} current={isCur} onPress={() => start(l)} />
            </View>
          );
        })}
      </ScrollView>
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12, width: W }]}>
        <BigButton label={`${t('play')} · ${t(`chapter_${CHAPTERS[cur.chapterIndex].id}` as never)} ${cur.index + 1}`} icon="▶" onPress={() => start(cur)} breathe testID="journey-play" />
      </View>
      {heartsSheet ? (
        <View style={st.dim}>
          <PopIn style={[st.sheet, shadow.card]}>
            <T size={40} center>{hearts.count > 0 ? '❤️' : '💔'}</T>
            <T size={20} weight="black" center>{hearts.count > 0 ? `${t('hearts')} ${hearts.count}/${balance.hearts.max}` : t('hearts_empty')}</T>
            {hearts.nextInMs ? <T size={13} weight="semi" color={colors.inkSoft} center>{t('hearts_next', { time: fmtTime(hearts.nextInMs) })}</T> : null}
            {hearts.count < balance.hearts.max ? (
              <View style={{ gap: 8 }}>
                <SmallButton label={`${t('hearts_refill')} · ${balance.prices.heartRefill}`} icon="🪙" color={colors.accent} textColor={colors.white} disabled={save.coins < balance.prices.heartRefill} onPress={refillCoins} testID="hearts-refill" />
                {ads.rewardedReady() ? <SmallButton label={t('hearts_ad')} icon="▶" color={colors.gold} textColor={colors.white} onPress={refillAd} testID="hearts-ad" /> : null}
              </View>
            ) : null}
            <T size={12} weight="semi" color={colors.inkSoft} center>{t('hearts_other_modes')}</T>
            <Press onPress={() => setHeartsSheet(false)} testID="hearts-close"><T size={14} weight="bold" color={colors.inkSoft} center style={{ padding: 8 }}>{t('close')}</T></Press>
          </PopIn>
        </View>
      ) : null}
    </View>
  );
}

function Node({ level, stars, open, current, onPress }: { level: LevelDef; stars: number; open: boolean; current: boolean; onPress: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const p = useSharedValue(1);
  useEffect(() => {
    if (current) p.value = withRepeat(withSequence(withTiming(1.12, { duration: 600, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) })), -1);
  }, [current, p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  const bg = !open ? colors.disabled : stars > 0 ? (level.boss ? colors.gold : colors.correct) : colors.accent;
  return (
    <Animated.View style={a}>
      <Press onPress={onPress} disabled={!open} testID={`node-${level.id}`}>
        <View style={[st.node, { backgroundColor: bg }, shadow.card, level.boss && st.boss, current && st.current]}>
          <T size={level.boss ? 26 : 22} weight="black" color={colors.white}>{level.boss ? '👑' : open ? String(level.index + 1) : '🔒'}</T>
        </View>
      </Press>
      <View style={st.nodeStars}>
        {[1, 2, 3].map((i) => <T key={i} size={14} color={i <= stars ? colors.gold : 'rgba(15,23,42,0.18)'}>★</T>)}
      </View>
      {current ? <View style={st.marker}><T size={22}>📍</T></View> : null}
      {level.boss && stars === 0 ? <View style={st.chestTag}><T size={18}>🎁</T></View> : null}
    </Animated.View>
  );
}

function Segment({ x1, y1, x2, y2, done }: { x1: number; y1: number; x2: number; y2: number; done: boolean }) {
  const colors = usePalette();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 4, width: len, height: 8, borderRadius: 4,
      backgroundColor: done ? colors.correctSoft : 'rgba(255,255,255,0.7)', transform: [{ rotate: `${ang}rad` }] }} />
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8, zIndex: 2 },
  starsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 12, height: 40 },
  chapter: { position: 'absolute', left: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12 },
  lockedCard: { opacity: 0.75 },
  nodeWrap: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { width: NODE, height: NODE, borderRadius: NODE / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  boss: { width: NODE + 8, height: NODE + 8, borderRadius: (NODE + 8) / 2, marginLeft: -4 },
  current: { borderColor: colors.gold },
  nodeStars: { flexDirection: 'row', justifyContent: 'center', marginTop: 1 },
  marker: { position: 'absolute', top: -26, left: NODE / 2 - 11 },
  chestTag: { position: 'absolute', right: -16, top: -6 },
  bottom: { position: 'absolute', bottom: 0, paddingHorizontal: 16 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 20, gap: 10, width: '100%', maxWidth: 380 },
});
