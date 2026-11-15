// The "one more round" machine. Rewards play in beats: score counts up, stars pop, coins and XP fly to their
// counters, the XP bar fills (level-up moment), new Atlas cards flip, missions tick, a near goal, then the
// big button into the next round. Tap anywhere to skip to the end.
import { Image } from 'expo-image';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
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
import { colors, layout, motion, radius, shadow } from '../theme';

export type NextAction = { label: string; icon?: string; go: () => void };

export function ResultScreen({ summary, quiz, coinsBefore, primary, secondary, onDouble, grid }: {
  summary: RoundSummary; quiz: QuizDef; coinsBefore: number; primary: NextAction; secondary?: NextAction;
  onDouble?: () => Promise<boolean>; grid?: boolean[];
}) {
  const { width: SW } = useWindowDimensions();
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
      const unl = u.unlocks.map((x) => ({ icon: x === 'daily' ? '📅' : x === 'quick' ? '⚡' : '💀', label: t(`unlock_${x}` as never) }));
      out.push({ kind: 'level', icon: '⭐', title: t('level_up'), subtitle: t('level_reached', { n: u.level }), rewards: [{ icon: '🪙', label: `+${fmt(u.coins)}` }, ...unl] });
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
      for (let i = 1; i <= S.stars; i++) later((at += B * 0.75), () => { setBeat(1 + i); play(`star_${i}` as never); haptic.medium(); });
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
        kind: 'chest', icon: '🎁', title: t('chest_title'), subtitle: t(`chapter_${CHAPTERS[LEVEL_BY_ID[S.levelId!].chapterIndex].id}` as never),
        rewards: [{ icon: '🪙', label: `+${fmt(S.chest.coins)}` }, { icon: '½', label: '+1' }, { icon: '❄️', label: '+1' }, { icon: '🏅', label: t('title_chapter', { chapter: t(`chapter_${CHAPTERS[LEVEL_BY_ID[S.levelId!].chapterIndex].id}` as never) }) }],
      });
    }
    if (S.streakMilestone) queue.current.push({ kind: 'streak', icon: '🔥', title: t('streak_milestone', { n: S.streakMilestone.days }), rewards: [{ icon: '🪙', label: `+${fmt(S.streakMilestone.coins)}` }] });
    for (const r of S.regions) queue.current.push({ kind: 'region', icon: '🗺️', title: t('region_complete', { region: t(`region_${r}` as never) }), rewards: [{ icon: '🪙', label: `+${balance.rewards.regionCompleteCoins}` }] });
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
    if (r === 'copied') setShareMsg('📋 ✓');
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

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={skip} testID="result-skip" />
      <View style={[st.top, { paddingTop: insets.top + 8, width: W, alignSelf: 'center' }]} pointerEvents="box-none">
        <LevelBadge level={xpShown.level} xp={xpShown.xp} need={need} />
        <CoinPill value={coinsShown} bumpKey={bump} />
      </View>
      <ScrollView contentContainerStyle={[st.scroll, { width: W, alignSelf: 'center', paddingBottom: insets.bottom + 24 }]} pointerEvents="box-none">
        <Pressable onPress={skip}>
          <View ref={scoreRef} style={[st.scoreCard, shadow.card]}>
            <T size={14} weight="black" color={colors.inkSoft}>{t('result_title')}</T>
            <PopIn><T size={30} weight="black" center>{headline}</T></PopIn>
            <View style={st.scoreRow}>
              <T size={52} weight="black" color={colors.accent}>{beat >= 1 ? `${S.correct}` : '?'}</T>
              <T size={30} weight="black" color={colors.ink}>{`/${S.total}`}</T>
            </View>
            {isJourney ? <Stars n={S.stars} beat={beat} /> : null}
            {grid ? <T size={18}>{gridFor(grid)}</T> : null}
            <View style={st.scoreLine}>
              <T size={12} weight="bold" color={colors.inkSoft}>{t('score')}</T>
              {beat >= 1 ? <CountUp value={S.score} size={22} sound /> : <T size={22} weight="black">0</T>}
              {S.isBest && beat >= 1 ? <PopIn delay={500}><View style={st.best}><T size={11} weight="black" color={colors.white}>{t('new_best')}</T></View></PopIn> : null}
            </View>
            {S.maxCombo >= 3 ? <T size={12} weight="bold" color={colors.flame}>{`🔥 ${t('combo')} x${Math.min(5, S.maxCombo)}`}</T> : null}
          </View>
        </Pressable>

        {beat >= 5 ? (
          <PopIn style={[st.card, shadow.soft]}>
            <View style={st.rewardRow}>
              <View style={st.reward}><View style={st.coinIcon} /><T size={20} weight="black">{`+${fmt(S.coinsTotal + (doubled ? S.coinsTotal : 0))}`}</T></View>
              <View style={st.reward}><T size={18} color={colors.accent}>✦</T><T size={20} weight="black">{`+${fmt(S.xpTotal)} XP`}</T></View>
              {S.heartLost ? <View style={st.reward}><T size={16}>💔</T><T size={14} weight="bold" color={colors.wrong}>{t('heart_lost')}</T></View> : null}
            </View>
            {beat >= 6 ? (
              <View style={{ gap: 4, marginTop: 8 }}>
                <T size={11} weight="bold" color={colors.inkSoft}>{t('goal_level', { n: xpShown.level + 1, xp: Math.max(0, need - xpShown.xp) })}</T>
                <ProgressBar value={need ? xpShown.xp / need : 1} />
              </View>
            ) : null}
          </PopIn>
        ) : null}

        {beat >= 7 && (newCards.length || masteryUps.length) ? (
          <PopIn style={[st.card, shadow.soft]}>
            <T size={13} weight="black" color={colors.inkSoft}>{`${t('new_cards')} · ${newCards.length}`}</T>
            <View style={st.cards}>
              {[...newCards, ...masteryUps].slice(0, 8).map((c, i) => <AtlasCardFlip key={c.key} id={c.id} kind={c.kind} delay={i * 110} mastery={c.masteryUp} />)}
            </View>
          </PopIn>
        ) : null}

        {beat >= 8 ? (
          <PopIn style={[st.card, shadow.soft, { gap: 8 }]}>
            <StreakLine summary={S} />
            {S.missions.map((m) => (
              <View key={m.id} style={{ gap: 3 }}>
                <View style={st.rowBetween}>
                  <T size={12} weight="bold">{t(`mission_${m.id}` as never, { n: m.target })}</T>
                  <T size={12} weight="black" color={m.done ? colors.correct : colors.inkSoft}>{m.done ? '✓' : `${m.to}/${m.target}`}</T>
                </View>
                <ProgressBar value={m.to / m.target} color={m.done ? colors.correct : colors.gold} height={7} />
              </View>
            ))}
          </PopIn>
        ) : null}

        {beat >= 9 ? (
          <PopIn style={{ gap: 10, marginTop: 4 }}>
            {S.nearMiss ? (
              <T size={15} weight="black" color={colors.accent} center>
                {S.nearMiss.need === 1 ? t('near_miss_one', { stars: S.nearMiss.stars }) : t('near_miss_stars', { n: S.nearMiss.need, stars: S.nearMiss.stars })}
              </T>
            ) : null}
            <BigButton label={primary.label} icon={primary.icon} onPress={primary.go} breathe testID="result-primary" />
            <View style={st.secondaryRow}>
              {secondary ? <SmallButton label={secondary.label} icon="🏠" onPress={secondary.go} testID="result-home" style={{ flex: 1 }} /> : null}
              <SmallButton label={shareMsg ?? t('share')} icon="↗" onPress={onShare} testID="result-share" style={{ flex: 1 }} />
              {doubleOk && !doubled ? <SmallButton label={t('double_coins')} icon="▶" color={colors.gold} textColor={colors.white} onPress={doDouble} testID="result-double" style={{ flex: 1.3 }} /> : null}
            </View>
          </PopIn>
        ) : null}
      </ScrollView>
      <ShareCard ref={shareRef} correct={S.correct} total={S.total} stars={S.stars} grid={grid ? gridFor(grid) : undefined}
        title={upper(t(quiz.topicLabel === 'usa' ? 'q_state' : quiz.topicLabel === 'flags' ? 'q_flag' : 'q_country'))}
        subtitle={upper(t(`topic_${quiz.topicLabel}` as never))} />
      {celebrate ? <Celebration spec={celebrate} onClose={closeCelebration} /> : null}
    </View>
  );
}

function Stars({ n, beat }: { n: number; beat: number }) {
  return (
    <View style={st.stars}>
      {[1, 2, 3].map((i) => <Star key={i} on={i <= n && beat >= 1 + i} big={i === 2} />)}
    </View>
  );
}

function Star({ on, big }: { on: boolean; big: boolean }) {
  const s = useSharedValue(on ? 1 : 0.85);
  useEffect(() => {
    if (on) s.value = withSequence(withTiming(1.6, { duration: 120 }), withSpring(1, { damping: 7, stiffness: 220 }));
  }, [on, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }, { translateY: big ? -6 : 0 }] }));
  return (
    <Animated.View style={a}>
      <T size={big ? 50 : 42} color={on ? colors.gold : colors.track} style={on ? st.starGlow : undefined}>★</T>
    </Animated.View>
  );
}

function AtlasCardFlip({ id, kind, delay, mastery }: { id: string; kind: string; delay: number; mastery: number | null }) {
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
      {flag ? <Image source={flag} style={st.atlasFlag} contentFit="cover" /> : <T size={18}>🗺️</T>}
      <T size={9} weight="bold" center lines={2}>{itemName(id)}</T>
      {mastery ? <T size={9} weight="black" color={colors.goldDark}>{mastery === 3 ? '🥇' : mastery === 2 ? '🥈' : '🥉'}</T> : <T size={8} weight="black" color={colors.correct}>NEW</T>}
    </Animated.View>
  );
}

function StreakLine({ summary }: { summary: RoundSummary }) {
  const e = summary.streak;
  let text = '';
  if (e.kind === 'started') text = `🔥 ${t('streak_started')}`;
  else if (e.kind === 'extended') text = `🔥 ${t('streak_day', { n: e.count })}`;
  else if (e.kind === 'froze') text = `❄️ ${t('streak_froze')}`;
  else if (e.kind === 'broken') text = `🔥 ${t('streak_day', { n: e.count })}`;
  else text = `🔥 ${t('streak_day', { n: e.count })}`;
  useEffect(() => {
    if (e.kind === 'started' || e.kind === 'extended' || e.kind === 'froze') play('flame');
  }, [e.kind]);
  return (
    <View style={st.rowBetween}>
      <T size={14} weight="black" color={colors.flame}>{text}</T>
      {e.kind !== 'same_day' ? <T size={11} weight="bold" color={colors.inkSoft}>{t('streak_tomorrow')}</T> : null}
    </View>
  );
}

const st = StyleSheet.create({
  bg: { backgroundColor: '#C9E2F6' },
  top: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, zIndex: 3 },
  scroll: { padding: 12, gap: 10 },
  scoreCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: 16, alignItems: 'center', gap: 4 },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  scoreLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  best: { backgroundColor: colors.flame, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  stars: { flexDirection: 'row', gap: 6, alignItems: 'flex-end', height: 62 },
  starGlow: { textShadowColor: 'rgba(245,158,11,0.6)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 0 } },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14 },
  rewardRow: { flexDirection: 'row', gap: 18, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coinIcon: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.gold, borderWidth: 3, borderColor: '#FCD34D' },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  atlasCard: { width: 64, height: 78, borderRadius: 10, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', padding: 4, gap: 2, borderWidth: 2, borderColor: 'transparent' },
  atlasFlag: { width: 40, height: 28, borderRadius: 3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  secondaryRow: { flexDirection: 'row', gap: 8 },
});

export { Press };
