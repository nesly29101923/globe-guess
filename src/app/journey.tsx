// The Journey: one page per chapter, swiped left and right like a level map. Each page fits on the screen:
// the chapter card, ten levels winding upwards to the boss, and the PLAY button. No long vertical scroll.
import { router, useIsFocused } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

type ViewToken = { index: number | null };
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { CHAPTERS, LEVELS, type LevelDef } from '../config/levels';
import { HeartsPill, IconButton, ScreenHeader, StatPill } from '../components/hud';
import { Coin, Icon, type IconName } from '../components/Icon';
import { BigButton, Press, ProgressBar, Sheet, SheetTitle, SmallButton, T } from '../components/ui';
import { fmtTime, t } from '../i18n/strings';
import { buy } from '../logic/economy';
import { chapterLock, chapterStars, currentLevel, heartsNow, isLevelOpen, refillHearts, totalStars } from '../logic/journey';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { layout, radius, shadow, sizes, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

const NODE = 56;
// x positions (share of the path width) for levels 1..10, bottom to top: a gentle S-curve
const XS = [0.5, 0.8, 0.5, 0.2, 0.5, 0.8, 0.5, 0.2, 0.5, 0.8];

export default function JourneyScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const update = useGame((g) => g.update);
  const [heartsSheet, setHeartsSheet] = useState(false);
  const [, setTick] = useState(0);
  const now = useGame.getState().now();
  const hearts = heartsNow(save, now);
  const cur = currentLevel(save);
  const [page, setPage] = useState(cur.chapterIndex);
  const list = useRef<FlatList<number>>(null);

  // hearts refill over time: refresh the counter every 10 s while this screen is on top and a heart is missing
  useEffect(() => {
    if (!focused || hearts.count >= balance.hearts.max) return undefined;
    const h = setInterval(() => setTick((x) => x + 1), 10000);
    return () => clearInterval(h);
  }, [focused, hearts.count]);

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

  const headerH = insets.top + 8 + sizes.hud + 8;
  const bottomH = sizes.big + 24 + insets.bottom;
  const pageH = SH - headerH - bottomH;
  const go = (i: number) => {
    const k = Math.max(0, Math.min(CHAPTERS.length - 1, i));
    list.current?.scrollToIndex({ index: k, animated: true });
    setPage(k);
  };
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const v = viewableItems[0];
    if (v && typeof v.index === 'number') setPage(v.index);
  }).current;
  const chapters = useMemo(() => CHAPTERS.map((_, i) => i), []);
  const pageCh = CHAPTERS[page];
  const pageLock = chapterLock(save, page);
  const renderPage = useCallback(({ item: ci }: { item: number }) => (
    <ChapterPage ci={ci} width={SW} height={pageH} save={save} cur={cur} onStart={start} onPrev={() => go(ci - 1)} onNext={() => go(ci + 1)} active={focused && ci === page} />
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [SW, pageH, save, cur.id, focused, page]);

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <ScreenHeader title={t('journey')} onBack={() => router.back()} testID="journey-back" right={
          <View style={st.topRight}>
            <StatPill icon="star" color={colors.gold} value={String(totalStars(save))} />
            {balance.hearts.enabled ? <HeartsPill count={hearts.count} max={balance.hearts.max} nextIn={null} onPress={() => setHeartsSheet(true)} /> : null}
            <IconButton icon="book-open-variant" onPress={() => router.push('/atlas')} testID="journey-atlas" />
          </View>
        } />
      </View>
      <FlatList
        ref={list}
        data={chapters}
        keyExtractor={(i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={cur.chapterIndex}
        getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
        renderItem={renderPage}
        onViewableItemsChanged={onViewable as never}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        windowSize={3}
        initialNumToRender={1}
        style={{ flexGrow: 0, height: pageH, width: SW }}
      />
      <View style={[st.bottom, { paddingBottom: insets.bottom + 12, width: W }]}>
        {page === cur.chapterIndex ? (
          <BigButton label={`${t('play')} · ${t('level_short', { n: cur.index + 1 })}`} icon={cur.boss ? 'crown' : 'play'} onPress={() => start(cur)} breathe={focused} testID="journey-play" />
        ) : page < cur.chapterIndex ? (
          <BigButton label={t('chapter_back_to', { n: cur.chapterIndex + 1 })} icon="arrow-right-bold" color={colors.surface} textColor={colors.accent} onPress={() => go(cur.chapterIndex)} testID="journey-current" />
        ) : (
          <View style={[st.lockBar, shadow.soft]}>
            <Icon name="lock" size={22} color={colors.inkSoft} />
            <T size={type.body} weight="bold" color={colors.inkSoft} lines={2} style={{ flexShrink: 1 }}>
              {pageLock.needBoss ? t('locked_boss') : t('locked_open_with', { n: pageCh.starsToOpen, have: totalStars(save) })}
            </T>
          </View>
        )}
      </View>
      {heartsSheet ? (
        <Sheet onClose={() => setHeartsSheet(false)} testID="hearts-sheet">
          <SheetTitle title={hearts.count > 0 ? `${t('hearts')} ${hearts.count}/${balance.hearts.max}` : t('hearts_empty')}
            icon={<Icon name={hearts.count > 0 ? 'heart' : 'heart-broken'} size={28} color={colors.heart} />} onClose={() => setHeartsSheet(false)} />
          <View style={st.heartsRow}>
            {Array.from({ length: balance.hearts.max }, (_, i) => <Icon key={i} name={i < hearts.count ? 'heart' : 'heart-outline'} size={34} color={colors.heart} />)}
          </View>
          {hearts.nextInMs ? <T size={type.body} weight="semi" color={colors.inkSoft} center>{t('hearts_next', { time: fmtTime(hearts.nextInMs) })}</T> : null}
          {hearts.count < balance.hearts.max ? (
            <View style={{ gap: 8 }}>
              <SmallButton label={`${t('hearts_refill')} · ${balance.prices.heartRefill}`} iconNode={<Coin size={18} />} color={colors.accent} textColor={colors.white} disabled={save.coins < balance.prices.heartRefill} onPress={refillCoins} testID="hearts-refill" />
              {ads.rewardedReady() ? <SmallButton label={t('hearts_ad')} icon="play-circle" color={colors.gold} textColor={colors.white} onPress={refillAd} testID="hearts-ad" /> : null}
            </View>
          ) : null}
          <T size={type.label} weight="semi" color={colors.inkSoft} center>{t('hearts_other_modes')}</T>
        </Sheet>
      ) : null}
    </View>
  );
}

function ChapterPage({ ci, width, height, save, cur, onStart, onPrev, onNext, active }: {
  ci: number; width: number; height: number; save: ReturnType<typeof useGame.getState>['save']; cur: LevelDef;
  onStart: (l: LevelDef) => void; onPrev: () => void; onNext: () => void; active: boolean;
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const c = CHAPTERS[ci];
  const lock = chapterLock(save, ci);
  const cs = chapterStars(save, c.id);
  const levels = LEVELS.filter((l) => l.chapter === c.id);
  const W = Math.min(width, layout.maxWidth);
  const cardH = 76;
  const pathTop = cardH + 24;
  const pathH = height - pathTop - 8;
  const rowH = pathH / levels.length;
  const pathW = W - 48 - NODE;
  const pos = levels.map((_, i) => ({ x: 24 + XS[i % XS.length] * pathW, y: pathTop + pathH - (i + 1) * rowH + (rowH - NODE) / 2 }));
  return (
    <View style={{ width, height, alignItems: 'center' }}>
      <View style={{ width: W, height }}>
        {/* chapter card with arrows to the neighbours */}
        <View style={[st.chapter, shadow.soft, { width: W - 24, height: cardH }, !lock.open && st.lockedCard]}>
          <Press onPress={onPrev} disabled={ci === 0} testID={`chapter-prev-${ci}`}>
            <View style={[st.arrow, ci === 0 && { opacity: 0.25 }]}><Icon name="chevron-left" size={26} color={colors.ink} /></View>
          </Press>
          <View style={st.chapterIcon}><Icon name={lock.open ? (c.icon as IconName) : 'lock'} size={26} color={lock.open ? colors.accent : colors.inkSoft} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T size={type.caption} weight="bold" color={colors.inkSoft}>{t('chapter', { n: ci + 1 }).toUpperCase()}</T>
            <T size={type.heading} weight="black" lines={1} shrink>{t(`chapter_${c.id}` as never)}</T>
            <View style={st.inline}>
              <Icon name="star" size={14} color={colors.gold} />
              <T size={type.caption} weight="black">{`${cs.have}/${cs.max}`}</T>
              <View style={{ flex: 1, marginLeft: 6 }}><ProgressBar value={cs.have / cs.max} color={colors.gold} height={5} /></View>
            </View>
          </View>
          <Press onPress={onNext} disabled={ci === CHAPTERS.length - 1} testID={`chapter-next-${ci}`}>
            <View style={[st.arrow, ci === CHAPTERS.length - 1 && { opacity: 0.25 }]}><Icon name="chevron-right" size={26} color={colors.ink} /></View>
          </Press>
        </View>
        {/* path */}
        {pos.map((p, i) => {
          const n = pos[i + 1];
          if (!n) return null;
          const done = (save.journey.stars[levels[i].id] ?? 0) > 0;
          return <Segment key={`s${i}`} x1={p.x + NODE / 2} y1={p.y + NODE / 2} x2={n.x + NODE / 2} y2={n.y + NODE / 2} done={done} />;
        })}
        {levels.map((l, i) => (
          <View key={l.id} style={[st.nodeWrap, { left: pos[i].x, top: pos[i].y }]}>
            <Node level={l} stars={save.journey.stars[l.id] ?? 0} open={isLevelOpen(save, l)} current={l.id === cur.id} active={active} onPress={() => onStart(l)} />
          </View>
        ))}
      </View>
    </View>
  );
}

function Node({ level, stars, open, current, active, onPress }: { level: LevelDef; stars: number; open: boolean; current: boolean; active: boolean; onPress: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const p = useSharedValue(1);
  useEffect(() => {
    p.value = current && active ? withRepeat(withSequence(withTiming(1.1, { duration: 650, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) })), -1) : withTiming(1);
  }, [current, active, p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  const bg = !open ? colors.disabled : stars > 0 ? (level.boss ? colors.gold : colors.correct) : colors.accent;
  const size = level.boss ? NODE + 8 : NODE;
  return (
    <Animated.View style={[{ alignItems: 'center' }, a]}>
      <Press onPress={onPress} disabled={!open} testID={`node-${level.id}`}>
        <View style={[st.node, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg, marginLeft: level.boss ? -4 : 0 }, shadow.card, current && st.current]}>
          {level.boss ? <Icon name="crown" size={28} color={colors.white} /> : open ? <T size={type.title} weight="black" color={colors.white}>{String(level.index + 1)}</T> : <Icon name="lock" size={20} color={colors.white} />}
        </View>
      </Press>
      <View style={st.nodeStars}>
        {[1, 2, 3].map((i) => <Icon key={i} name="star" size={13} color={i <= stars ? colors.gold : 'rgba(15,23,42,0.18)'} />)}
      </View>
      {current ? <View style={st.marker}><Icon name="map-marker" size={26} color={colors.wrong} /></View> : null}
      {level.boss && stars === 0 ? <View style={st.chestTag}><Icon name="treasure-chest" size={22} color={colors.goldDark} /></View> : null}
    </Animated.View>
  );
}

function Segment({ x1, y1, x2, y2, done }: { x1: number; y1: number; x2: number; y2: number; done: boolean }) {
  const colors = usePalette();
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1);
  return (
    <View style={{ position: 'absolute', left: (x1 + x2) / 2 - len / 2, top: (y1 + y2) / 2 - 4, width: len, height: 8, borderRadius: 4,
      backgroundColor: done ? colors.correctSoft : 'rgba(255,255,255,0.75)', transform: [{ rotate: `${ang}rad` }] }} />
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { paddingHorizontal: 12, paddingBottom: 8, zIndex: 2 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chapter: { position: 'absolute', left: 12, top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 4 },
  chapterIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  arrow: { width: 36, height: 56, alignItems: 'center', justifyContent: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  lockedCard: { opacity: 0.85 },
  nodeWrap: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  current: { borderColor: colors.gold, borderBottomColor: colors.gold },
  nodeStars: { flexDirection: 'row', justifyContent: 'center', marginTop: 1 },
  marker: { position: 'absolute', top: -26 },
  chestTag: { position: 'absolute', right: -24, top: -4 },
  bottom: { position: 'absolute', bottom: 0, paddingHorizontal: 16 },
  lockBar: { height: sizes.big, borderRadius: radius.xl, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 20 },
  heartsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
