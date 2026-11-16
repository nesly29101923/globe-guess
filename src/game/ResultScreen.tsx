// The "one more round" machine. Rewards play in beats: score counts up, stars pop, coins and XP fly to their
// counters, the XP bar fills (level-up moment), new Atlas cards flip, missions tick, a near goal, then the
// big button into the next round. Tap anywhere to skip to the end.
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP } from '../config/app';
import { balance } from '../config/balance';
import { CHAPTERS, LEVEL_BY_ID } from '../config/levels';
import { Celebration, type CelebrationSpec } from '../components/Celebration';
import { fx } from '../components/fx';
import { CoinPill, CountUp, LevelBadge } from '../components/hud';
import { ShareCard } from '../components/ShareCard';
import { BigButton, PopIn, Press, ProgressBar, SmallButton, T } from '../components/ui';
import { Coin, Icon, type IconName } from '../components/Icon';
import { GridSquares } from '../components/round';
import { FLAG_IMAGES } from '../data/flagImages';
import { itemName } from '../data/gameData';
import { haptic } from '../feedback/haptics';
import { play } from '../feedback/sfx';
import { fmt, t, upper } from '../i18n/strings';
import { dailyShareText, gridFor } from '../logic/daily';
import { xpToNext } from '../logic/progression';
import type { RoundSummary } from '../logic/round';
import type { QuizDef } from '../logic/types';
import { ads } from '../services/ads';
import { shareCard } from '../services/share';
import { useGame } from '../store/store';
import { rewardItems } from './rewardItems';
import { layout, motion, radius, shadow, sizes, type, type Palette } from '../theme';
import { usePalette, useStyles } from '../theme/usePalette';

export type NextAction = { label: string; icon?: IconName; go: () => void };

export function ResultScreen({ summary, quiz, coinsBefore, primary, secondary, onDouble, grid }: {
  summary: RoundSummary; quiz: QuizDef; coinsBefore: number; primary: NextAction; secondary?: NextAction;
  onDouble?: () => Promise<boolean>; grid?: boolean[];
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const S = summary;
  const [beat, setBeat] = useState(0);
  const [coinsShown, setCoinsShown] = useState(coinsBefore);
  const [bump, setBump] = useState(0);
  const [xpShown, setXpShown] = useState(S.xpBefore);
  const [celebrate, setCelebrate] = useState<CelebrationSpec | null>(null);
  const [doubled, setDoubled] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const queue = useRef<CelebrationSpec[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const skipped = useRef(false);
  const shareRef = useRef<React.ComponentRef<typeof View>>(null);
  const scoreRef = useRef<React.ComponentRef<typeof View>>(null);
  const isJourney = S.mode === 'journey' || S.mode === 'first';

  // ---- celebrations to show at the right beat
  const specs = useMemo(() => {
    const out: CelebrationSpec[] = [];
    for (const u of S.levelUps) {
      out.push({ kind: u.reward.chest ? 'chest' : 'level', icon: u.reward.chest ? 'treasure-chest' : 'star-four-points', title: t('level_up'), subtitle: t('level_reached', { n: u.level }), rewards: rewardItems(u.reward, u.coins) });
    }
    return out;
  }, [S]);

  const later = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ---- the beats
  useEffect(() => {
    const B = motion.beat;
    let at = 0;
    later((at += 100), () => setBeat(1));                      // score count-up
    if (isJourney) {
      for (let i = 1; i <= S.stars; i++) later((at += B * 0.75), () => { setBeat(1 + i); play(`star_${i}` as never); if (i === S.stars) haptic.tap(); });
      if (S.stars === 0) at += B;
    }
    later((at += B), () => {                                     // coins + XP fly
      setBeat(5);
      const from = { x: SW / 2, y: 200 };
      scoreRef.current?.measureInWindow((x, y, w, h) => {
        from.x = x + w / 2;
        from.y = y + h / 2;
      });
      const n = Math.min(10, Math.max(3, Math.round(S.coinsTotal / 8)));
      if (S.coinsTotal > 0) {
        let landed = 0;
        later(30, () => fx.coins(from, n, {
          onLand: () => {
            landed += 1;
            setBump((b) => b + 1);
            setCoinsShown(coinsBefore + Math.round((S.coinsTotal * landed) / n));
          },
        }));
      }
      if (S.xpTotal > 0) later(200, () => fx.coins(from, 5, { to: 'xp' }));
    });
    later((at += B * 2), () => { setBeat(6); setXpShown({ level: save.level, xp: save.xp }); setCoinsShown(save.coins); });
    if (specs.length) later((at += B * 1.2), () => showCelebrations(specs));
    later((at += B), () => setBeat(7));                          // cards
    later((at += B + Math.min(6, S.cards.length) * 110), () => setBeat(8)); // missions + streak
    later((at += B), () => setBeat(9));                          // goal + buttons
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showCelebrations = (list: CelebrationSpec[]) => {
    queue.current = [...list];
    if (S.chest) {
      queue.current.push({
        kind: 'chest', icon: 'treasure-chest', title: t('chest_title'), subtitle: t(`chapter_${CHAPTERS[LEVEL_BY_ID[S.levelId!].chapterIndex].id}` as never),
        rewards: [{ icon: 'coin', label: `+${fmt(S.chest.coins)}` }, { icon: 'circle-half-full', label: '+1' }, { icon: 'snowflake', label: '+1' }, { icon: 'medal', label: t('title_chapter', { chapter: t(`chapter_${CHAPTERS[LEVEL_BY_ID[S.levelId!].chapterIndex].id}` as never) }) }],
      });
    }
    if (S.streakMilestone) queue.current.push({ kind: 'streak', icon: 'fire', title: t('streak_milestone', { n: S.streakMilestone.days }), rewards: [{ icon: 'coin', label: `+${fmt(S.streakMilestone.coins)}` }] });
    for (const r of S.regions) queue.current.push({ kind: 'region', icon: 'earth', title: t('region_complete', { region: t(`region_${r}` as never) }), rewards: [{ icon: 'coin', label: `+${balance.rewards.regionCompleteCoins}` }] });
    setCelebrate(queue.current.shift() ?? null);
  };
  const extraShown = useRef(false);
  useEffect(() => {
    // chest / streak / region moments come after the level-ups (or on their own)
    if (beat === 6 && !specs.length && !extraShown.current && (S.chest || S.streakMilestone || S.regions.length)) {
      extraShown.current = true;
      later(motion.beat, () => showCelebrations([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat]);

  const skip = () => {
    if (beat >= 9 || skipped.current) return;
    skipped.current = true;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBeat(9);
    setCoinsShown(save.coins);
    setXpShown({ level: save.level, xp: save.xp });
    if (specs.length || S.chest || S.streakMilestone || S.regions.length) showCelebrations(specs);
  };

  const closeCelebration = () => {
    const nextOne = queue.current.shift() ?? null;
    setCelebrate(nextOne);
  };

  // ---- texts
  const headline = S.mode === 'daily' ? t('result_daily') : S.mode === 'survival' ? t('result_survival')
    : S.failed ? t('result_fail') : S.correct === S.total ? t('result_perfect') : S.stars >= 2 || S.correct >= 7 ? t('result_great') : t('result_good');
  const need = xpToNext(xpShown.level);
  const newCards = S.cards.filter((c) => c.isNew);
  const masteryUps = S.cards.filter((c) => !c.isNew && c.masteryUp);
  const shareText = S.mode === 'daily' && grid
    ? dailyShareText(APP.name, useGame.getState().today(), S.correct, gridFor(grid), S.score)
    : t('share_text', { correct: S.correct, total: S.total, app: APP.name });

  const onShare = async () => {
    const r = await shareCard(shareRef, shareText, S.mode);
    if (r === 'copied') setShareMsg(t('copied'));
  };

  const doDouble = async () => {
    if (!onDouble || doubled) return;
    const ok = await onDouble();
    if (ok) {
      setDoubled(true);
      fx.coins({ x: SW / 2, y: 300 }, 8, { onLand: () => setBump((b) => b + 1) });
      setCoinsShown(useGame.getState().save.coins);
    }
  };
  const doubleOk = !!onDouble && S.coinsTotal > 0 && ads.rewardedReady() && !useGame.getState().session.firstSession;
  useEffect(() => {
    if (beat === 9 && doubleOk) ads.offerShown('double_coins');
  }, [beat, doubleOk]);

  // ---- layout: everything fits on one screen. The density follows the height that is really free:
  // full (all cards), compact (smaller score, missions on one line), tiny (cards and streak folded into the rewards card)
  const avail = SH - insets.top - insets.bottom;
  const compact = avail < 800;
  const tiny = avail < 700;
  const cards = [...newCards, ...masteryUps];
  const maxCards = Math.max(3, Math.floor((W - 24 - 28) / 66));
  const shownCards = cards.length > maxCards ? cards.slice(0, maxCards - 1) : cards;
  const moreCards = cards.length - shownCards.length;

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.rays]} pointerEvents="none" />
      <View style={[st.top, { paddingTop: insets.top + 8, width: W, alignSelf: 'center' }]} pointerEvents="box-none">
        <LevelBadge level={xpShown.level} xp={xpShown.xp} need={need} />
        <CoinPill value={coinsShown} bumpKey={bump} />
      </View>

      <Pressable style={[st.middle, { width: W }]} onPress={skip} testID="result-skip">
        {/* score */}
        <View ref={scoreRef} style={[st.scoreCard, shadow.card, compact && { paddingVertical: 12 }]}>
          <View style={st.ribbon}><T size={type.caption} weight="black" color={colors.white}>{t('result_title')}</T></View>
          <PopIn><T size={compact ? type.title + 4 : type.display} weight="black" center lines={1} shrink>{headline}</T></PopIn>
          <View style={st.scoreRow}>
            <T size={tiny ? type.hero - 14 : compact ? type.hero - 8 : type.hero} weight="black" color={colors.accent}>{beat >= 1 ? `${S.correct}` : '?'}</T>
            <T size={compact ? type.title + 4 : type.display} weight="black" color={colors.ink}>{`/${S.total}`}</T>
          </View>
          {isJourney ? <Stars n={S.stars} beat={beat} size={tiny ? 34 : compact ? 38 : 46} /> : null}
          {grid ? <GridSquares results={grid} /> : null}
          <View style={st.scoreLine}>
            <T size={type.label} weight="bold" color={colors.inkSoft}>{t('score')}</T>
            {beat >= 1 ? <CountUp value={S.score} size={type.title} sound /> : <T size={type.title} weight="black">0</T>}
            {S.isBest && beat >= 1 ? <PopIn delay={500}><View style={st.best}><T size={type.caption} weight="black" color={colors.white}>{t('new_best')}</T></View></PopIn> : null}
            {S.maxCombo >= 3 ? (
              <View style={st.comboTag}><Icon name="fire" size={14} color={colors.flame} /><T size={type.caption} weight="black" color={colors.flame}>{`${t('combo')} x${Math.min(5, S.maxCombo)}`}</T></View>
            ) : null}
          </View>
        </View>

        {/* rewards: coins, XP and the bar to the next level */}
        <View style={[st.card, shadow.soft, beat < 5 && st.hidden]}>
          {beat >= 5 ? (
            <PopIn style={{ gap: 8 }}>
              <View style={st.rewardRow}>
                <View style={st.reward}><Coin size={24} /><T size={type.title} weight="black">{`+${fmt(S.coinsTotal + (doubled ? S.coinsTotal : 0))}`}</T></View>
                <View style={st.reward}><Icon name="star-four-points" size={22} color={colors.accent} /><T size={type.title} weight="black">{`+${fmt(S.xpTotal)} XP`}</T></View>
                {S.heartLost ? <View style={st.reward}><Icon name="heart-broken" size={20} color={colors.wrong} /><T size={type.label} weight="bold" color={colors.wrong}>{t('heart_lost')}</T></View> : null}
                {tiny && cards.length ? <View style={st.reward}><Icon name="book-open-variant" size={20} color={colors.accent} /><T size={type.title} weight="black">{`+${cards.length}`}</T></View> : null}
              </View>
              <View style={{ gap: 4, opacity: beat >= 6 ? 1 : 0 }}>
                <T size={type.caption} weight="bold" color={colors.inkSoft}>{t('goal_level', { n: xpShown.level + 1, xp: Math.max(0, need - xpShown.xp) })}</T>
                <ProgressBar value={need ? xpShown.xp / need : 1} height={8} />
              </View>
              {tiny ? <View style={{ opacity: beat >= 8 ? 1 : 0 }}><StreakLine summary={S} /></View> : null}
            </PopIn>
          ) : <View style={{ height: 64 }} />}
        </View>

        {/* new Atlas cards: one row, never hidden under the buttons */}
        {cards.length && !tiny ? (
          <View style={[st.card, shadow.soft, { paddingVertical: 10 }, beat < 7 && st.hidden]}>
            {beat >= 7 ? (
              <PopIn style={{ gap: 6 }}>
                <View style={st.rowBetween}>
                  <View style={st.inline}><Icon name="book-open-variant" size={16} color={colors.accent} /><T size={type.label} weight="black">{t('new_cards')}</T></View>
                  <T size={type.label} weight="black" color={colors.accent}>{`+${cards.length}`}</T>
                </View>
                <View style={st.cards}>
                  {shownCards.map((c, i) => <AtlasCardFlip key={c.key} id={c.id} kind={c.kind} delay={i * 110} mastery={c.masteryUp} />)}
                  {moreCards > 0 ? <View style={[st.atlasCard, st.moreCard]}><T size={type.heading} weight="black" color={colors.accent}>{`+${moreCards}`}</T></View> : null}
                </View>
              </PopIn>
            ) : <View style={{ height: 92 }} />}
          </View>
        ) : null}

        {/* streak and missions */}
        {!tiny ? <View style={[st.card, shadow.soft, { gap: 6, paddingVertical: 10 }, beat < 8 && st.hidden]}>
          {beat >= 8 ? (
            <PopIn style={{ gap: 6 }}>
              <StreakLine summary={S} />
              {compact ? (
                S.missions.length ? (
                  <View style={st.inline}>
                    <Icon name="clipboard-check" size={16} color={colors.correct} />
                    <T size={type.label} weight="bold">{`${t('missions')} · ${S.missions.filter((m) => m.done).length}/${S.missions.length}`}</T>
                  </View>
                ) : null
              ) : S.missions.map((m) => (
                <View key={m.id} style={st.missionRow}>
                  <Icon name={m.done ? 'check-circle' : 'clipboard-check-outline'} size={18} color={m.done ? colors.correct : colors.inkSoft} />
                  <T size={type.label} weight="bold" style={{ flex: 1 }} lines={1}>{t(`mission_${m.id}` as never, { n: m.target })}</T>
                  <View style={{ width: 60 }}><ProgressBar value={m.to / m.target} color={m.done ? colors.correct : colors.gold} height={6} /></View>
                  <T size={type.caption} weight="black" color={m.done ? colors.correct : colors.inkSoft} style={{ width: 34, textAlign: 'right' }}>{`${Math.min(m.to, m.target)}/${m.target}`}</T>
                </View>
              ))}
            </PopIn>
          ) : <View style={{ height: 22 }} />}
        </View> : null}
      </Pressable>

      {/* the next round: the biggest button, sliding up when the rewards are done */}
      <View style={[st.actions, { width: W, paddingBottom: insets.bottom + 10 }]}>
        {beat >= 9 ? (
          <SlideUp>
            {S.nearMiss ? (
              <View style={st.nearMiss}>
                <Icon name="star" size={18} color={colors.gold} />
                <T size={type.body} weight="black" color={colors.accent} center>
                  {S.nearMiss.need === 1 ? t('near_miss_one', { stars: S.nearMiss.stars }) : t('near_miss_stars', { n: S.nearMiss.need, stars: S.nearMiss.stars })}
                </T>
              </View>
            ) : null}
            <BigButton label={primary.label} icon={primary.icon} onPress={primary.go} breathe testID="result-primary" />
            <View style={st.secondaryRow}>
              {secondary ? <SmallButton label={secondary.label} icon="home" onPress={secondary.go} testID="result-home" style={{ flex: 1 }} /> : null}
              <SmallButton label={shareMsg ?? t('share')} icon={shareMsg ? 'check-bold' : 'share-variant'} onPress={onShare} testID="result-share" style={{ flex: 1 }} />
              {doubleOk && !doubled ? <SmallButton label={t('double_short')} icon="play-circle" color={colors.gold} textColor={colors.white} onPress={doDouble} testID="result-double" style={{ flex: 1.3 }} /> : null}
            </View>
          </SlideUp>
        ) : <View style={{ height: sizes.big + sizes.small + 10 }} />}
      </View>
      <ShareCard ref={shareRef} correct={S.correct} total={S.total} stars={S.stars} results={grid}
        title={upper(t(quiz.topicLabel === 'usa' ? 'q_state' : quiz.topicLabel === 'flags' ? 'q_flag' : 'q_country'))}
        subtitle={upper(t(`topic_${quiz.topicLabel}` as never))} />
      {celebrate ? <Celebration spec={celebrate} onClose={closeCelebration} /> : null}
    </View>
  );
}

/** The bottom buttons arrive from below with a spring, like a game's "next" panel. */
function SlideUp({ children }: { children: React.ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSpring(1, { damping: 14, stiffness: 170, mass: 0.8 });
  }, [v]);
  const a = useAnimatedStyle(() => ({ opacity: Math.min(1, v.value * 2), transform: [{ translateY: (1 - v.value) * 140 }] }));
  return <Animated.View style={[{ gap: 10 }, a]}>{children}</Animated.View>;
}

function Stars({ n, beat, size }: { n: number; beat: number; size: number }) {
  const st = useStyles(make_st);
  return (
    <View style={[st.stars, { height: size + 14 }]}>
      {[1, 2, 3].map((i) => <Star key={i} on={i <= n && beat >= 1 + i} big={i === 2} size={size} />)}
    </View>
  );
}

function Star({ on, big, size }: { on: boolean; big: boolean; size: number }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const s = useSharedValue(on ? 1 : 0.85);
  useEffect(() => {
    if (on) s.value = withSequence(withTiming(1.6, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 220 }));
  }, [on, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateY: big ? -6 : 0 }] }));
  void st;
  return (
    <Animated.View style={a}>
      <Icon name="star" size={big ? size + 8 : size} color={on ? colors.gold : colors.track} />
    </Animated.View>
  );
}

function AtlasCardFlip({ id, kind, delay, mastery }: { id: string; kind: string; delay: number; mastery: number | null }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = withDelay(delay, withTiming(1, { duration: 360 }));
    const h = setTimeout(() => play('card'), delay + 120);
    return () => clearTimeout(h);
  }, [delay, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ perspective: 400 }, { rotateY: `${(1 - r.value) * 180}deg` }, { scale: 0.8 + 0.2 * r.value }] }));
  const flag = kind !== 'state' ? FLAG_IMAGES[id] : undefined;
  return (
    <Animated.View style={[st.atlasCard, mastery ? { borderColor: mastery === 3 ? colors.gold : mastery === 2 ? '#94A3B8' : '#B45309' } : null, a]}>
      {flag ? <Image source={flag} style={st.atlasFlag} contentFit="cover" /> : <Icon name="map-marker" size={22} color={colors.accent} />}
      <T size={9} weight="bold" center lines={1}>{itemName(id)}</T>
      {mastery ? <Icon name="medal" size={12} color={mastery === 3 ? colors.gold : mastery === 2 ? '#94A3B8' : '#B45309'} /> : <T size={9} weight="black" color={colors.correct}>{t('new_tag')}</T>}
    </Animated.View>
  );
}

function StreakLine({ summary }: { summary: RoundSummary }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const e = summary.streak;
  let text = '';
  if (e.kind === 'started') text = t('streak_started');
  else if (e.kind === 'froze') text = t('streak_froze');
  else text = t('streak_day', { n: e.count });
  useEffect(() => {
    if (e.kind === 'started' || e.kind === 'extended' || e.kind === 'froze') play('flame');
  }, [e.kind]);
  return (
    <View style={st.rowBetween}>
      <View style={st.inline}>
        <Icon name={e.kind === 'froze' ? 'snowflake' : 'fire'} size={18} color={e.kind === 'froze' ? '#0EA5E9' : colors.flame} />
        <T size={type.body} weight="black" color={colors.flame} lines={1}>{text}</T>
      </View>
      {e.kind !== 'same_day' ? <T size={type.caption} weight="bold" color={colors.inkSoft}>{t('streak_tomorrow')}</T> : null}
    </View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  rays: { position: 'absolute', top: -200, width: 640, height: 640, borderRadius: 320, backgroundColor: colors.surface, opacity: 0.35 },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 3 },
  middle: { flex: 1, paddingHorizontal: 12, paddingTop: 14, gap: 10, justifyContent: 'center' },
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 16, paddingTop: 22, paddingBottom: 14, alignItems: 'center', gap: 2, marginTop: 10 },
  ribbon: { position: 'absolute', top: -12, backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 14, height: 24, justifyContent: 'center' },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  best: { backgroundColor: colors.flame, borderRadius: 99, paddingHorizontal: 8, height: 20, justifyContent: 'center' },
  comboTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stars: { flexDirection: 'row', gap: 4, alignItems: 'flex-end' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12 },
  hidden: { opacity: 0 },
  rewardRow: { flexDirection: 'row', gap: 18, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cards: { flexDirection: 'row', gap: 6 },
  atlasCard: { width: 60, height: 70, borderRadius: 10, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', padding: 3, gap: 2, borderWidth: 2, borderColor: 'transparent' },
  moreCard: { backgroundColor: colors.accentSoft },
  atlasFlag: { width: 40, height: 28, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nearMiss: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secondaryRow: { flexDirection: 'row', gap: 8 },
  actions: { paddingHorizontal: 12, paddingTop: 8, alignSelf: 'center' },
});

export { Press };
