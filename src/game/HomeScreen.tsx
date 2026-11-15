// Home: streak, coins, level, today's Daily Challenge and missions, the big PLAY button. It is alive when idle
// and always shows something to claim or something close.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { CHAPTERS } from '../config/levels';
import { Celebration, type CelebrationSpec } from '../components/Celebration';
import { fx } from '../components/fx';
import { CoinPill, IconButton, LevelBadge } from '../components/hud';
import { BigButton, Dot, PopIn, Press, ProgressBar, SmallButton, T } from '../components/ui';
import { haptic } from '../feedback/haptics';
import { play, setMenuMusic } from '../feedback/sfx';
import { fmt, fmtTime, t } from '../i18n/strings';
import { totalDiscovered } from '../logic/atlas';
import { canClaimLogin, canClaimMissionChest, claimLogin, claimMission, claimMissionChest, dailyPlayed, ensureMissions } from '../logic/daily';
import { freeCoinsLeft, grantFreeCoins, starterAvailable } from '../logic/economy';
import { chapterStars, currentLevel, heartsNow, nextChapterGoal, syncHearts, totalStars } from '../logic/journey';
import { nextReward, totalXpTo, xpToNext } from '../logic/progression';
import { rewardItems, rewardLine } from './rewardItems';
import { canRepair, displayedStreak, repair, streakAtRisk } from '../logic/streak';
import { msToMidnight } from '../logic/time';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { colors, layout, radius, shadow, type Palette } from '../theme';
import { LoginCalendar } from './LoginCalendar';
import { showPendingNotificationAsk } from './notify';
import { usePalette, useStyles } from '../theme/usePalette';

export function HomeScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const W = Math.min(SW, layout.maxWidth);
  const save = useGame((g) => g.save);
  const update = useGame((g) => g.update);
  const today = useGame.getState().today();
  const now = useGame.getState().now();
  const [tick, setTick] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [celebrate, setCelebrate] = useState<CelebrationSpec | null>(null);
  const [coinBump, setCoinBump] = useState(0);

  // daily refresh: missions for today, hearts regenerated, first visit flag
  useEffect(() => {
    update((s) => {
      let n = ensureMissions(s, today);
      n = syncHearts(n, now);
      if (!n.ftue.homeSeen) n = { ...n, ftue: { ...n.ftue, homeSeen: true } };
      return n;
    });
    const h = setInterval(() => setTick((x) => x + 1), 1000);
    showPendingNotificationAsk();
    setMenuMusic(true);
    return () => {
      clearInterval(h);
      setMenuMusic(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // the login reward greets the player once a day (not in the very first visit, which already celebrates enough)
  useEffect(() => {
    if (canClaimLogin(save, today) && save.ftue.homeSeen && save.totalRounds >= 2) {
      const h = setTimeout(() => setShowLogin(true), 600);
      return () => clearTimeout(h);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);
  void tick;

  const lv = currentLevel(save);
  const ch = CHAPTERS[lv.chapterIndex];
  const streak = displayedStreak(save, today);
  const atRisk = streakAtRisk(save, today);
  const dailyUnlocked = save.level >= balance.unlocks.dailyChallenge;
  const dailyDone = dailyPlayed(save, today);
  const hearts = heartsNow(save, useGame.getState().now());
  const goal = nextChapterGoal(save);
  const need = xpToNext(save.level);
  const nextR = nextReward(save.level);
  const freeLeft = freeCoinsLeft(save, today);
  const loginClaimable = canClaimLogin(save, today);
  const missionsClaimable = save.missions.list.some((m) => !m.claimed && m.progress >= m.target) || canClaimMissionChest(save);
  const repairable = canRepair(save, today);
  const chStars = chapterStars(save, ch.id);
  // the Starter Pack: a calm banner, at most one day in a row is never pushed as a pop-up
  const [starterToday] = useState(() => {
    const g = useGame.getState();
    return starterAvailable(g.save, g.now(), g.session.firstSession) && g.save.shop.starterShownDay !== today;
  });
  useEffect(() => {
    if (starterToday) update((s) => ({ ...s, shop: { ...s.shop, starterShownDay: today } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterToday]);

  const goalText = goal && goal.needStars > 0
    ? t('goal_chapter', { n: goal.needStars, chapter: t(`chapter_${CHAPTERS[goal.chapterIndex].id}` as never) })
    : t('goal_level', { n: save.level + 1, xp: need - save.xp });

  const flyCoinsFrom = (y: number, n: number) => fx.coins({ x: SW / 2, y }, n, { onLand: () => setCoinBump((b) => b + 1) });

  const onClaimMission = (id: string, y: number) => {
    const r = claimMission(useGame.getState().save, id);
    if (!r.coins) return;
    update(() => r.state);
    analytics.log('coins_earned', { source: 'mission', amount: r.coins, balance: r.state.coins });
    flyCoinsFrom(y, 6);
    haptic.success();
  };
  const onMissionChest = () => {
    const r = claimMissionChest(useGame.getState().save);
    if (!r.coins) return;
    update(() => r.state);
    setCelebrate({ kind: 'chest', icon: '🎁', title: t('all_missions_chest'), rewards: [{ icon: '🪙', label: `+${fmt(r.coins)}` }, { icon: '½', label: '+1' }] });
  };
  const onLogin = () => {
    const r = claimLogin(useGame.getState().save, today);
    if (!r.coins) return setShowLogin(false);
    update(() => r.state);
    analytics.log('daily_reward_claimed', { day: r.dayIndex + 1 });
    analytics.log('coins_earned', { source: 'login', amount: r.coins, balance: r.state.coins });
    setShowLogin(false);
    if (r.chest) setCelebrate({ kind: 'chest', icon: '🎁', title: t('login_day', { n: 7 }), rewards: [{ icon: '🪙', label: `+${fmt(r.coins)}` }, { icon: '½', label: `+${balance.daily.loginDay7Powerups}` }, { icon: '❄️', label: `+${balance.daily.loginDay7Powerups}` }] });
    else flyCoinsFrom(300, 8);
  };
  const onFreeCoins = async () => {
    const ok = await ads.rewarded('free_coins');
    if (!ok) return;
    update((s) => grantFreeCoins(s, today));
    analytics.log('coins_earned', { source: 'ad_free', amount: balance.ads.rewardedFreeCoins, balance: useGame.getState().save.coins });
    flyCoinsFrom(500, 8);
  };
  const onRepair = async () => {
    const s = useGame.getState().save;
    if (s.coins >= balance.daily.streakRepairCoins) {
      update((x) => ({ ...repair(x), coins: x.coins - balance.daily.streakRepairCoins }));
      analytics.log('coins_spent', { sink: 'streak_repair', amount: balance.daily.streakRepairCoins, balance: s.coins - balance.daily.streakRepairCoins });
    } else {
      const ok = await ads.rewarded('streak_repair');
      if (!ok) return;
      update((x) => repair(x));
    }
    play('flame');
    setCelebrate({ kind: 'streak', icon: '🔥', title: t('streak_day', { n: useGame.getState().save.streak.count }) });
  };

  const playJourney = () => {
    if (hearts.count <= 0 && balance.hearts.enabled) return router.push('/journey');
    router.push({ pathname: '/play', params: { mode: 'journey', level: lv.id, nonce: String(Date.now()) } });
  };

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <LevelBadge level={save.level} xp={save.xp} need={need} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <CoinPill value={save.coins} bumpKey={coinBump} onPress={() => router.push('/shop')} testID="home-coins" />
          <IconButton icon="⚙️" onPress={() => router.push('/settings')} testID="home-settings" />
        </View>
      </View>
      <ScrollView contentContainerStyle={[st.scroll, { width: W, paddingBottom: insets.bottom + 24 }]}>
        {/* streak */}
        <PopIn style={[st.streak, shadow.card]}>
          <Flame lit={streak > 0} />
          <View style={{ flex: 1 }}>
            <T size={22} weight="black">{streak > 0 ? t('streak_day', { n: streak }) : t('streak_none')}</T>
            <T size={12} weight="semi" color={atRisk ? colors.flame : colors.inkSoft}>
              {streak > 0 && save.streak.lastDay === today ? t('streak_tomorrow') : t('streak_today')}
            </T>
          </View>
          {save.streak.freezes > 0 ? <View style={st.freeze}><T size={14}>❄️</T><T size={13} weight="black">{String(save.streak.freezes)}</T></View> : null}
          <Press onPress={() => setShowLogin(true)} testID="home-calendar">
            <View style={st.calendarBtn}><T size={22}>📅</T>{loginClaimable ? <Dot /> : null}</View>
          </Press>
        </PopIn>
        {repairable ? (
          <PopIn style={[st.card, shadow.soft, st.rowBetween]}>
            <T size={13} weight="bold" style={{ flex: 1 }}>{t('streak_broken', { n: save.streak.broken?.count ?? 0 })}</T>
            <SmallButton label={save.coins >= balance.daily.streakRepairCoins ? `${t('streak_repair')} · ${balance.daily.streakRepairCoins}` : t('streak_repair')} icon={save.coins >= balance.daily.streakRepairCoins ? '🪙' : '▶'} color={colors.flame} textColor={colors.white} onPress={onRepair} testID="home-repair" />
          </PopIn>
        ) : null}

        {/* the one primary action */}
        <PopIn delay={60} style={[st.playCard, shadow.card]}>
          <View style={st.rowBetween}>
            <View>
              <T size={12} weight="bold" color={colors.inkSoft}>{`${t('chapter', { n: lv.chapterIndex + 1 })} · ${ch.icon}`}</T>
              <T size={20} weight="black">{t(`chapter_${ch.id}` as never)}</T>
            </View>
            <Press onPress={() => router.push('/journey')} testID="home-journey">
              <View style={st.hearts}><T size={13}>❤️</T><T size={13} weight="black">{String(hearts.count)}</T><T size={13} weight="black" color={colors.gold}>{`  ★ ${totalStars(save)}`}</T></View>
            </Press>
          </View>
          <ProgressBar value={chStars.have / chStars.max} color={colors.gold} height={8} />
          <BigButton label={`${t('play')} · ${lv.index + 1}/${ch.ramp.length}${lv.boss ? ' 👑' : ''}`} icon="▶" onPress={playJourney} breathe testID="home-play" />
          <T size={12} weight="bold" color={colors.accent} center>{goalText}</T>
        </PopIn>

        {/* next level reward: always something a few rounds away */}
        {nextR ? (
          <PopIn delay={90} style={[st.card, shadow.soft, st.rowBetween]}>
            <T size={24}>{nextR.reward.chest ? '🎁' : rewardItems(nextR.reward)[0]?.icon ?? '⭐'}</T>
            <View style={{ flex: 1, gap: 4 }}>
              <T size={13} weight="black">{rewardLine(nextR.level, nextR.reward)}</T>
              <ProgressBar value={nextR.level === save.level + 1 ? save.xp / need : 0} height={7} />
            </View>
            <T size={11} weight="bold" color={colors.inkSoft}>{`${Math.max(0, totalXpTo(nextR.level) - totalXpTo(save.level) - save.xp)} XP`}</T>
          </PopIn>
        ) : null}

        {/* daily challenge */}
        <PopIn delay={120}>
          <Press onPress={() => dailyUnlocked && !dailyDone && router.push({ pathname: '/play', params: { mode: 'daily', nonce: String(Date.now()) } })} disabled={!dailyUnlocked || dailyDone} testID="home-daily">
            <View style={[st.card, shadow.soft, st.rowBetween, !dailyUnlocked && st.locked]}>
              <T size={30}>{dailyDone ? '✅' : '📅'}</T>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <T size={16} weight="black">{t('daily_challenge')}</T>
                <T size={12} weight="semi" color={colors.inkSoft}>
                  {!dailyUnlocked ? t('daily_locked', { n: balance.unlocks.dailyChallenge }) : dailyDone
                    ? `${save.daily.results[today]?.correct ?? 0}/10 · ${t('daily_done', { time: fmtTime(msToMidnight(useGame.getState().now())) })}`
                    : t('daily_ready')}
                </T>
              </View>
              {dailyUnlocked && !dailyDone ? <View style={st.go}><T size={14} weight="black" color={colors.white}>▶</T><Dot /></View> : null}
            </View>
          </Press>
        </PopIn>

        {/* missions */}
        <PopIn delay={180} style={[st.card, shadow.soft, { gap: 10 }]}>
          <View style={st.rowBetween}>
            <T size={16} weight="black">{t('missions')}</T>
            <T size={11} weight="bold" color={colors.inkSoft}>{fmtTime(msToMidnight(useGame.getState().now()))}</T>
          </View>
          {save.missions.list.map((m, i) => (
            <View key={m.id} style={{ gap: 4 }}>
              <View style={st.rowBetween}>
                <T size={13} weight="bold" style={{ flex: 1 }}>{t(`mission_${m.id}` as never, { n: m.target })}</T>
                {m.claimed ? <T size={13} weight="black" color={colors.correct}>✓</T> : m.progress >= m.target ? (
                  <SmallButton label={`+${balance.daily.missionCoins}`} icon="🪙" color={colors.correct} textColor={colors.white} onPress={() => onClaimMission(m.id, 420 + i * 50)} testID={`mission-claim-${i}`} />
                ) : <T size={12} weight="black" color={colors.inkSoft}>{`${m.progress}/${m.target}`}</T>}
              </View>
              <ProgressBar value={m.progress / m.target} color={m.progress >= m.target ? colors.correct : colors.gold} height={7} />
            </View>
          ))}
          <View style={st.rowBetween}>
            <T size={12} weight="bold" color={colors.inkSoft}>{t('all_missions_chest')}</T>
            <Wobble on={canClaimMissionChest(save)}>
              <Press onPress={onMissionChest} disabled={!canClaimMissionChest(save)} testID="mission-chest">
                <View style={[st.chest, save.missions.chestClaimed && { opacity: 0.4 }]}><T size={26}>{save.missions.chestClaimed ? '📭' : '🎁'}</T>{canClaimMissionChest(save) ? <Dot /> : null}</View>
              </Press>
            </Wobble>
          </View>
        </PopIn>

        {/* modes */}
        <PopIn delay={240} style={st.tiles}>
          <Tile icon="⚡" title={t('quick_play')} desc={t('quick_desc')} lockedAt={save.level < balance.unlocks.quickPlay ? balance.unlocks.quickPlay : null} onPress={() => router.push('/quick')} testID="home-quick" />
          <Tile icon="💀" title={t('survival')} desc={save.stats.survivalBest ? `${t('best')}: ${save.stats.survivalBest}` : t('survival_desc')} lockedAt={save.level < balance.unlocks.survival ? balance.unlocks.survival : null}
            onPress={() => router.push({ pathname: '/play', params: { mode: 'survival', nonce: String(Date.now()) } })} testID="home-survival" />
          <Tile icon="🗺️" title={t('atlas')} desc={t('atlas_discovered', { n: totalDiscovered(save) })} onPress={() => router.push('/atlas')} testID="home-atlas" />
          <Tile icon="🛍️" title={t('shop')} desc={t('shop_powerups')} onPress={() => router.push('/shop')} testID="home-shop" lockedAt={save.level < balance.unlocks.shop ? balance.unlocks.shop : null} />
        </PopIn>

        {starterToday ? (
          <PopIn delay={280}>
            <Press onPress={() => router.push('/shop')} testID="home-starter">
              <View style={[st.starter, shadow.soft]}>
                <T size={26}>🎁</T>
                <View style={{ flex: 1 }}>
                  <T size={15} weight="black" color={colors.white}>{t('starter_pack')}</T>
                  <T size={11} weight="semi" color={colors.white}>{t('starter_desc')}</T>
                </View>
                <T size={18} weight="black" color={colors.white}>›</T>
              </View>
            </Press>
          </PopIn>
        ) : null}
        {freeLeft > 0 && ads.rewardedReady() && !useGame.getState().session.firstSession ? (
          <PopIn delay={300}>
            <SmallButton label={`${t('free_coins')} +${balance.ads.rewardedFreeCoins} (${freeLeft})`} icon="▶" color={colors.gold} textColor={colors.white} onPress={onFreeCoins} testID="home-free-coins" />
          </PopIn>
        ) : null}
      </ScrollView>
      {showLogin ? <LoginCalendar save={save} today={today} onClaim={onLogin} onClose={() => setShowLogin(false)} /> : null}
      {celebrate ? <Celebration spec={celebrate} onClose={() => { setCelebrate(null); setCoinBump((b) => b + 1); }} /> : null}
    </View>
  );
}

function Flame({ lit }: { lit: boolean }) {
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = withRepeat(withSequence(withTiming(1, { duration: 420, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 380, easing: Easing.inOut(Easing.sin) })), -1);
  }, [f]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: lit ? 1 + 0.08 * f.value : 1 }, { rotate: `${lit ? -4 + 8 * f.value : 0}deg` }], opacity: lit ? 1 : 0.35 }));
  return <Animated.View style={a}><T size={40}>🔥</T></Animated.View>;
}

function Wobble({ on, children }: { on: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = on ? withRepeat(withSequence(withTiming(-1, { duration: 90 }), withTiming(1, { duration: 90 }), withTiming(-1, { duration: 90 }), withTiming(0, { duration: 90 }), withTiming(0, { duration: 900 })), -1) : withTiming(0);
  }, [on, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 9}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

function Tile({ icon, title, desc, onPress, lockedAt, testID }: { icon: string; title: string; desc: string; onPress: () => void; lockedAt?: number | null; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} disabled={!!lockedAt} style={st.tileWrap} testID={testID}>
      <View style={[st.tile, shadow.soft, lockedAt ? st.locked : null]}>
        <T size={30}>{lockedAt ? '🔒' : icon}</T>
        <T size={14} weight="black" center>{title}</T>
        <T size={11} weight="semi" color={colors.inkSoft} center lines={2}>{lockedAt ? t('daily_locked', { n: lockedAt }) : desc}</T>
      </View>
    </Press>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  scroll: { padding: 12, gap: 12 },
  streak: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  freeze: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#E0F2FE', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  calendarBtn: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  playCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 16, gap: 12 },
  hearts: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.chip, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  go: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  chest: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.goldSoft, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileWrap: { width: '48%', flexGrow: 1 },
  tile: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 12, alignItems: 'center', gap: 2, minHeight: 112, justifyContent: 'center' },
  locked: { opacity: 0.6 },
  starter: { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
