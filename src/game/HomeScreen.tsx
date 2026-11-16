// Home: one screen, no scrolling, laid out like a game lobby.
// - The world map is the backdrop, framed on the current chapter (drawn once, it never animates).
// - Top bar: level (tap for the coming rewards), coins (tap for the shop), settings. All the same height.
// - Side buttons: streak, Daily Challenge, missions on the left; daily reward, free coins, offer on the right.
//   Each opens a sheet that says what it is and what it gives, so nothing is hidden at the bottom of a list.
// - Bottom: the chapter card with the one big PLAY button, the next goal, and a dock with the other modes.
import { router, useIsFocused } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { CHAPTERS } from '../config/levels';
import { COSMETICS } from '../config/cosmetics';
import { Celebration, type CelebrationSpec } from '../components/Celebration';
import { fx } from '../components/fx';
import { CoinPill, IconButton, LevelBadge } from '../components/hud';
import { Coin, Icon, RewardIcon, type IconName } from '../components/Icon';
import { BigButton, Dot, PopIn, Press, ProgressBar, Sheet, SheetTitle, SmallButton, T } from '../components/ui';
import { haptic } from '../feedback/haptics';
import { play, setMenuMusic } from '../feedback/sfx';
import { fmt, fmtTime, t } from '../i18n/strings';
import { totalDiscovered } from '../logic/atlas';
import { canClaimLogin, canClaimMissionChest, claimLogin, claimMission, claimMissionChest, dailyPlayed, ensureMissions } from '../logic/daily';
import { freeCoinsLeft, grantFreeCoins, starterAvailable } from '../logic/economy';
import { chapterStars, currentLevel, heartsNow, nextChapterGoal, syncHearts } from '../logic/journey';
import { nextReward, rewardAt, totalXpTo, xpToNext } from '../logic/progression';
import { canRepair, displayedStreak, repair, streakAtRisk } from '../logic/streak';
import { msToMidnight } from '../logic/time';
import type { Topic } from '../config/levels';
import { neutralCam, type Box, type Cam } from '../map/camera';
import { StaticMap, regionCam } from '../map/StaticMap';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { layout, mapThemes, radius, shadow, sizes, type, type Palette } from '../theme';
import { useIsDark, usePalette, useStyles } from '../theme/usePalette';
import { LoginCalendar } from './LoginCalendar';
import { showPendingNotificationAsk } from './notify';
import { rewardHeadline, rewardItems, type RewardItem } from './rewardItems';

type SheetKind = 'missions' | 'free' | 'streak' | 'daily' | 'level' | null;

export function HomeScreen() {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const W = Math.min(SW, layout.maxWidth);
  const compact = SH < 720;
  const save = useGame((g) => g.save);
  const update = useGame((g) => g.update);
  const today = useGame.getState().today();
  const now = useGame.getState().now();
  const [showLogin, setShowLogin] = useState(false);
  const [sheet, setSheet] = useState<SheetKind>(null);
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
    showPendingNotificationAsk();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  // music only while home is the screen on top
  useEffect(() => {
    setMenuMusic(focused);
    return () => setMenuMusic(false);
  }, [focused]);

  // the login reward greets the player once a day (not in the very first visit, which already celebrates enough)
  useEffect(() => {
    if (canClaimLogin(save, today) && save.ftue.homeSeen && save.totalRounds >= 2) {
      const h = setTimeout(() => setShowLogin(true), 600);
      return () => clearTimeout(h);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const lv = currentLevel(save);
  const ch = CHAPTERS[lv.chapterIndex];
  const streak = displayedStreak(save, today);
  const atRisk = streakAtRisk(save, today);
  const dailyUnlocked = save.level >= balance.unlocks.dailyChallenge;
  const dailyDone = dailyPlayed(save, today);
  const hearts = heartsNow(save, now);
  const goal = nextChapterGoal(save);
  const need = xpToNext(save.level);
  const nextR = nextReward(save.level);
  const freeLeft = freeCoinsLeft(save, today);
  const loginClaimable = canClaimLogin(save, today);
  const missionsReady = save.missions.list.filter((m) => !m.claimed && m.progress >= m.target).length + (canClaimMissionChest(save) ? 1 : 0);
  const missionsDone = save.missions.list.filter((m) => m.progress >= m.target).length;
  const repairable = canRepair(save, today);
  const chStars = chapterStars(save, ch.id);
  const showFree = !useGame.getState().session.firstSession;
  // the Starter Pack: a calm side button, never pushed as a pop-up
  const [starterToday] = useState(() => {
    const g = useGame.getState();
    return starterAvailable(g.save, g.now(), g.session.firstSession);
  });
  useEffect(() => {
    if (starterToday && save.shop.starterShownDay !== today) update((s) => ({ ...s, shop: { ...s.shop, starterShownDay: today } }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starterToday]);

  const goalText = goal && goal.needStars > 0
    ? t('goal_chapter', { n: goal.needStars, chapter: t(`chapter_${CHAPTERS[goal.chapterIndex].id}` as never) })
    : t('goal_level', { n: save.level + 1, xp: need - save.xp });

  // ---- backdrop: the map framed on this chapter's part of the world
  const dark = useIsDark();
  const chosen = COSMETICS.find((c) => c.id === save.cosmetics.mapTheme)?.theme ?? 'classic';
  const theme = mapThemes[chosen === 'classic' && dark ? 'night' : chosen] ?? mapThemes.classic;
  const topic: Topic = ch.topic;
  const scene = topic === 'usa' ? 'usa' : 'world';
  const mapBox: Box = useMemo(() => ({ fx: SW / 2, fy: SH * 0.36, fw: SW * 0.9, fh: SH * 0.4, W: SW }), [SW, SH]);
  // memoised: a new camera object would rebuild the backdrop's paths on every render
  const mapCam: Cam = useMemo(() => {
    if (topic === 'usa') return { ...neutralCam('usa'), w: neutralCam('usa').w * 0.9 };
    if (topic === 'world') return { ...neutralCam('world'), w: neutralCam('world').w * 0.62 };
    return regionCam(topic, mapBox);
  }, [topic, mapBox]);

  // ---- actions
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
    setSheet(null);
    setCelebrate({ kind: 'chest', icon: 'treasure-chest', title: t('all_missions_chest'), rewards: [{ icon: 'coin', label: `+${fmt(r.coins)}` }, { icon: 'circle-half-full', label: '+1' }] });
  };
  const onLogin = () => {
    const r = claimLogin(useGame.getState().save, today);
    if (!r.coins) return setShowLogin(false);
    update(() => r.state);
    analytics.log('daily_reward_claimed', { day: r.dayIndex + 1 });
    analytics.log('coins_earned', { source: 'login', amount: r.coins, balance: r.state.coins });
    setShowLogin(false);
    if (r.chest) setCelebrate({ kind: 'chest', icon: 'treasure-chest', title: t('login_day', { n: 7 }), rewards: [{ icon: 'coin', label: `+${fmt(r.coins)}` }, { icon: 'circle-half-full', label: `+${balance.daily.loginDay7Powerups}` }, { icon: 'snowflake', label: `+${balance.daily.loginDay7Powerups}` }] });
    else flyCoinsFrom(SH * 0.3, 8);
  };
  const onFreeCoins = async () => {
    const ok = await ads.rewarded('free_coins');
    if (!ok) return;
    update((s) => grantFreeCoins(s, today));
    analytics.log('coins_earned', { source: 'ad_free', amount: balance.ads.rewardedFreeCoins, balance: useGame.getState().save.coins });
    setSheet(null);
    flyCoinsFrom(SH * 0.35, 8);
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
    setSheet(null);
    setCelebrate({ kind: 'streak', icon: 'fire', title: t('streak_day', { n: useGame.getState().save.streak.count }) });
  };
  const playDaily = () => {
    setSheet(null);
    router.push({ pathname: '/play', params: { mode: 'daily', nonce: String(Date.now()) } });
  };
  const playJourney = () => {
    if (hearts.count <= 0 && balance.hearts.enabled) return router.push('/journey');
    router.push({ pathname: '/play', params: { mode: 'journey', level: lv.id, nonce: String(Date.now()) } });
  };

  // ---- layout: sizes shrink a little on short phones so everything fits without scrolling
  const rail = compact ? 52 : sizes.rail;
  const dockH = sizes.dock;

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <StaticMap width={SW} height={SH} box={mapBox} scene={scene} topic={scene === 'usa' ? 'usa' : topic} cam={mapCam} theme={theme} />
      <View style={[st.veilTop, { height: insets.top + 70 }]} pointerEvents="none" />

      {/* top bar */}
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <LevelBadge level={save.level} xp={save.xp} need={need} onPress={() => setSheet('level')} testID="home-level" />
        <View style={st.topRight}>
          <CoinPill value={save.coins} bumpKey={coinBump} onPress={() => router.push('/shop')} testID="home-coins" />
          <IconButton icon="cog" onPress={() => router.push('/settings')} testID="home-settings" />
        </View>
      </View>

      {/* side buttons */}
      <View style={[st.rail, { top: insets.top + 8 + sizes.hud + 16, left: (SW - W) / 2 + 12, gap: compact ? 10 : 14 }]}>
        <RailButton size={rail} icon="fire" iconColor={streak > 0 ? colors.flame : colors.inkSoft} label={t('streak_short')} value={streak > 0 ? String(streak) : undefined}
          dot={repairable || atRisk} onPress={() => setSheet('streak')} testID="home-streak" flicker={streak > 0 && focused} />
        <RailButton size={rail} icon={dailyDone ? 'calendar-check' : 'calendar-star'} iconColor={dailyDone ? colors.correct : colors.accent} label={t('daily_short')}
          locked={!dailyUnlocked ? balance.unlocks.dailyChallenge : undefined} dot={dailyUnlocked && !dailyDone} onPress={() => setSheet('daily')} testID="home-daily" />
        <RailButton size={rail} icon="clipboard-check" iconColor={colors.correct} label={t('missions_short')} value={`${missionsDone}/${save.missions.list.length}`}
          count={missionsReady || undefined} onPress={() => setSheet('missions')} testID="home-missions" />
      </View>
      <View style={[st.rail, { top: insets.top + 8 + sizes.hud + 16, right: (SW - W) / 2 + 12, gap: compact ? 10 : 14 }]}>
        <RailButton size={rail} icon="gift" iconColor={colors.wrong} label={t('reward_short')} dot={loginClaimable} wobble={loginClaimable && focused}
          onPress={() => setShowLogin(true)} testID="home-calendar" />
        {showFree ? (
          <RailButton size={rail} icon="play-circle" iconColor={colors.gold} label={t('free_short')} tag={freeLeft > 0 ? `+${balance.ads.rewardedFreeCoins}` : undefined}
            dim={freeLeft <= 0} onPress={() => setSheet('free')} testID="home-free-coins" />
        ) : null}
        {starterToday ? (
          <RailButton size={rail} icon="sale" iconColor={colors.white} bg={colors.accent} label={t('offer_short')} onPress={() => router.push('/shop')} testID="home-starter" />
        ) : null}
      </View>

      {/* chapter card + PLAY */}
      <View style={[st.bottom, { bottom: insets.bottom + 10 + dockH + 12, width: W }]} pointerEvents="box-none">
        {nextR ? <NextRewardChip level={nextR.level} save={save} need={need} onPress={() => setSheet('level')} /> : null}
        <PopIn style={[st.playCard, shadow.card]}>
          <Press onPress={() => router.push('/journey')} testID="home-journey" scaleTo={0.97} sound="tap">
            <View style={st.chapterRow}>
              <View style={st.chapterIcon}><Icon name={ch.icon as IconName} size={26} color={colors.accent} /></View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={st.rowBetween}>
                  <T size={type.caption} weight="bold" color={colors.inkSoft}>{t('chapter', { n: lv.chapterIndex + 1 }).toUpperCase()}</T>
                  <View style={st.miniStats}>
                    <Icon name="star" size={15} color={colors.gold} />
                    <T size={type.label} weight="black">{`${chStars.have}/${chStars.max}`}</T>
                    {balance.hearts.enabled ? (
                      <>
                        <View style={{ width: 6 }} />
                        <Icon name="heart" size={15} color={colors.heart} />
                        <T size={type.label} weight="black">{String(hearts.count)}</T>
                      </>
                    ) : null}
                  </View>
                </View>
                <T size={type.heading} weight="black" lines={1}>{t(`chapter_${ch.id}` as never)}</T>
                <ProgressBar value={chStars.have / chStars.max} color={colors.gold} height={6} />
              </View>
              <Icon name="chevron-right" size={22} color={colors.inkSoft} />
            </View>
          </Press>
          <BigButton label={`${t('play')} · ${t('level_short', { n: lv.index + 1 })}`} icon={lv.boss ? 'crown' : 'play'} onPress={playJourney} breathe={focused} testID="home-play" />
          <T size={type.label} weight="bold" color={colors.accent} center lines={1}>{goalText}</T>
        </PopIn>
      </View>

      {/* dock: the other modes */}
      <View style={[st.dock, shadow.card, { bottom: insets.bottom + 10, width: W - 24, height: dockH }]}>
        <DockButton icon="map-marker-path" label={t('journey_short')} onPress={() => router.push('/journey')} testID="home-journey-dock" />
        <DockButton icon="lightning-bolt" label={t('quick_short')} lockedAt={save.level < balance.unlocks.quickPlay ? balance.unlocks.quickPlay : null} onPress={() => router.push('/quick')} testID="home-quick" />
        <DockButton icon="skull" label={t('survival_short')} lockedAt={save.level < balance.unlocks.survival ? balance.unlocks.survival : null}
          onPress={() => router.push({ pathname: '/play', params: { mode: 'survival', nonce: String(Date.now()) } })} testID="home-survival" />
        <DockButton icon="book-open-variant" label={t('atlas')} sub={String(totalDiscovered(save))} onPress={() => router.push('/atlas')} testID="home-atlas" />
        <DockButton icon="store" label={t('shop')} lockedAt={save.level < balance.unlocks.shop ? balance.unlocks.shop : null} onPress={() => router.push('/shop')} testID="home-shop" />
      </View>

      {/* sheets */}
      {sheet === 'missions' ? (
        <Sheet onClose={() => setSheet(null)} testID="missions-sheet">
          <SheetTitle title={t('missions')} icon={<Icon name="clipboard-check" size={26} color={colors.correct} />} onClose={() => setSheet(null)} />
          <Countdown ms={msToMidnight(now)} render={(time) => t('missions_reset', { time })} />
          {save.missions.list.map((m, i) => (
            <View key={m.id} style={st.missionRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={st.rowBetween}>
                  <T size={type.body} weight="bold" style={{ flex: 1 }} lines={2}>{t(`mission_${m.id}` as never, { n: m.target })}</T>
                  {m.claimed ? <Icon name="check-circle" size={22} color={colors.correct} /> : <T size={type.label} weight="black" color={colors.inkSoft}>{`${Math.min(m.progress, m.target)}/${m.target}`}</T>}
                </View>
                <ProgressBar value={m.progress / m.target} color={m.progress >= m.target ? colors.correct : colors.gold} height={8} />
              </View>
              {!m.claimed && m.progress >= m.target ? (
                <SmallButton label={`+${balance.daily.missionCoins}`} iconNode={<Coin size={18} />} color={colors.correct} textColor={colors.white} onPress={() => onClaimMission(m.id, SH * 0.4 + i * 60)} testID={`mission-claim-${i}`} />
              ) : (
                <View style={st.missionReward}><Coin size={16} /><T size={type.label} weight="black" color={colors.inkSoft}>{String(balance.daily.missionCoins)}</T></View>
              )}
            </View>
          ))}
          <View style={[st.chestRow, save.missions.chestClaimed && { opacity: 0.5 }]}>
            <Wobble on={canClaimMissionChest(save)}>
              <Icon name={save.missions.chestClaimed ? 'treasure-chest' : 'treasure-chest'} size={40} color={colors.goldDark} />
            </Wobble>
            <T size={type.body} weight="bold" style={{ flex: 1 }}>{t('all_missions_chest')}</T>
            {canClaimMissionChest(save) ? <SmallButton label={t('chest_open')} color={colors.gold} textColor={colors.white} onPress={onMissionChest} testID="mission-chest" /> : null}
          </View>
        </Sheet>
      ) : null}

      {sheet === 'free' ? (
        <Sheet onClose={() => setSheet(null)} testID="free-sheet">
          <SheetTitle title={t('free_coins')} icon={<Icon name="play-circle" size={28} color={colors.gold} />} onClose={() => setSheet(null)} />
          <View style={st.freeHero}>
            <Coin size={44} />
            <T size={type.display} weight="black" color={colors.goldDark}>{`+${balance.ads.rewardedFreeCoins}`}</T>
          </View>
          <T size={type.body} weight="semi" color={colors.inkSoft} center>{t('free_coins_body', { n: balance.ads.rewardedFreeCoins })}</T>
          <View style={st.freeLeft}>
            {Array.from({ length: balance.ads.rewardedFreeCoinsPerDay }, (_, i) => (
              <View key={i} style={[st.freePip, i < freeLeft ? { backgroundColor: colors.gold } : null]} />
            ))}
            <T size={type.label} weight="bold" color={colors.inkSoft}>{freeLeft > 0 ? t('free_coins_left', { n: freeLeft, max: balance.ads.rewardedFreeCoinsPerDay }) : t('free_coins_none')}</T>
          </View>
          {freeLeft > 0 ? (
            ads.rewardedReady()
              ? <BigButton label={t('watch_video')} icon="play" color={colors.gold} onPress={onFreeCoins} testID="free-watch" />
              : <T size={type.label} weight="bold" color={colors.inkSoft} center>{t('free_coins_unavailable')}</T>
          ) : null}
        </Sheet>
      ) : null}

      {sheet === 'streak' ? (
        <Sheet onClose={() => setSheet(null)} testID="streak-sheet">
          <SheetTitle title={streak > 0 ? t('streak_day', { n: streak }) : t('streak_none')} icon={<Icon name="fire" size={28} color={colors.flame} />} onClose={() => setSheet(null)} />
          <T size={type.body} weight="bold" color={atRisk ? colors.flame : colors.ink}>
            {streak > 0 && save.streak.lastDay === today ? t('streak_tomorrow') : t('streak_today')}
          </T>
          <T size={type.label} weight="semi" color={colors.inkSoft}>{t('streak_info')}</T>
          <View style={st.infoRow}>
            <Icon name="snowflake" size={22} color="#0EA5E9" />
            <View style={{ flex: 1 }}>
              <T size={type.body} weight="bold">{t('streak_freezes', { n: save.streak.freezes })}</T>
              <T size={type.caption} weight="semi" color={colors.inkSoft}>{t('streak_freeze_info')}</T>
            </View>
          </View>
          {repairable ? (
            <View style={{ gap: 8 }}>
              <T size={type.body} weight="bold" color={colors.wrong}>{t('streak_broken', { n: save.streak.broken?.count ?? 0 })}</T>
              <SmallButton label={save.coins >= balance.daily.streakRepairCoins ? `${t('streak_repair')} · ${balance.daily.streakRepairCoins}` : t('streak_repair')}
                iconNode={save.coins >= balance.daily.streakRepairCoins ? <Coin size={18} /> : <Icon name="play-circle" size={18} color={colors.white} />}
                color={colors.flame} textColor={colors.white} onPress={onRepair} testID="home-repair" />
            </View>
          ) : null}
        </Sheet>
      ) : null}

      {sheet === 'daily' ? (
        <Sheet onClose={() => setSheet(null)} testID="daily-sheet">
          <SheetTitle title={t('daily_challenge')} icon={<Icon name="calendar-star" size={28} color={colors.accent} />} onClose={() => setSheet(null)} />
          <T size={type.body} weight="semi" color={colors.inkSoft}>{t('daily_challenge_desc')}</T>
          {!dailyUnlocked ? (
            <View style={st.infoRow}><Icon name="lock" size={22} color={colors.inkSoft} /><T size={type.body} weight="bold">{t('daily_locked', { n: balance.unlocks.dailyChallenge })}</T></View>
          ) : dailyDone ? (
            <View style={st.infoRow}>
              <Icon name="check-circle" size={26} color={colors.correct} />
              <View style={{ flex: 1 }}>
                <T size={type.heading} weight="black">{`${save.daily.results[today]?.correct ?? 0}/10`}</T>
                <Countdown ms={msToMidnight(now)} render={(time) => t('daily_done', { time })} />
              </View>
            </View>
          ) : (
            <BigButton label={t('daily_play')} icon="play" onPress={playDaily} testID="daily-play" />
          )}
        </Sheet>
      ) : null}

      {sheet === 'level' ? (
        <Sheet onClose={() => setSheet(null)} testID="level-sheet">
          <SheetTitle title={t('level_title', { n: save.level })} icon={<Icon name="star-four-points" size={26} color={colors.accent} />} onClose={() => setSheet(null)} />
          <View style={{ gap: 6 }}>
            <View style={st.rowBetween}>
              <T size={type.label} weight="bold" color={colors.inkSoft}>{t('level_info')}</T>
            </View>
            <ProgressBar value={need ? save.xp / need : 1} height={10} />
            <T size={type.label} weight="black" color={colors.accent}>{t('goal_level', { n: save.level + 1, xp: need - save.xp })}</T>
          </View>
          <T size={type.label} weight="black" color={colors.inkSoft}>{t('coming_rewards').toUpperCase()}</T>
          {comingRewards(save.level, 3).map((r) => (
            <View key={r.level} style={st.levelRow}>
              <View style={st.levelNum}><T size={type.label} weight="black" color={colors.white}>{String(r.level)}</T></View>
              <View style={st.levelItems}>
                {r.items.map((it, i) => (
                  <View key={i} style={st.levelItem}><RewardIcon name={it.icon} size={18} /><T size={type.label} weight="bold" lines={1}>{it.label}</T></View>
                ))}
              </View>
              <T size={type.caption} weight="bold" color={colors.inkSoft}>{`${fmt(Math.max(0, totalXpTo(r.level) - totalXpTo(save.level) - save.xp))} XP`}</T>
            </View>
          ))}
        </Sheet>
      ) : null}

      {showLogin ? <LoginCalendar save={save} today={today} onClaim={onLogin} onClose={() => setShowLogin(false)} /> : null}
      {celebrate ? <Celebration spec={celebrate} onClose={() => { setCelebrate(null); setCoinBump((b) => b + 1); }} /> : null}
    </View>
  );
}

function comingRewards(level: number, n: number) {
  const out: { level: number; items: ReturnType<typeof rewardItems> }[] = [];
  for (let l = level + 1; out.length < n && l <= balance.xp.maxLevel; l++) {
    const r = rewardAt(l);
    const chest: RewardItem[] = r.chest ? [{ icon: 'treasure-chest', label: t('chest_open') }] : [];
    if (Object.keys(r).length) out.push({ level: l, items: [...chest, ...rewardItems(r)].slice(0, 3) });
  }
  return out;
}

/** "Level 7: Mint map" with how close it is. Tapping opens the level sheet. */
function NextRewardChip({ level, save, need, onPress }: { level: number; save: ReturnType<typeof useGame.getState>['save']; need: number; onPress: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const h = rewardHeadline(rewardAt(level));
  if (!h) return null;
  const toGo = Math.max(0, totalXpTo(level) - totalXpTo(save.level) - save.xp);
  const isNext = level === save.level + 1;
  return (
    <Press onPress={onPress} scaleTo={0.97} testID="home-next-reward">
      <View style={[st.rewardChip, shadow.soft]}>
        <RewardIcon name={h.icon} size={22} />
        <T size={type.label} weight="black" lines={1} style={{ flexShrink: 1 }}>{t('next_reward', { n: level, reward: h.label })}</T>
        <View style={{ width: 54 }}><ProgressBar value={isNext && need ? save.xp / need : 0} height={6} /></View>
        <T size={type.caption} weight="bold" color={colors.inkSoft}>{`${fmt(toGo)} XP`}</T>
      </View>
    </Press>
  );
}

/** A time that counts down on its own, so the whole screen does not re-render every second. */
function Countdown({ ms, render }: { ms: number; render: (time: string) => string }) {
  const colors = usePalette();
  const [end] = useState(() => Date.now() + ms);
  const [, setN] = useState(0);
  useEffect(() => {
    const h = setInterval(() => setN((x) => x + 1), 1000);
    return () => clearInterval(h);
  }, []);
  return <T size={type.label} weight="bold" color={colors.inkSoft}>{render(fmtTime(Math.max(0, end - Date.now())))}</T>;
}

/** Side button: a square card with an icon, a caption under it, and a dot, count or tag for what is waiting. */
function RailButton({ icon, iconColor, label, onPress, value, dot, count, tag, locked, dim, bg, size, testID, flicker, wobble }: {
  icon: IconName; iconColor: string; label: string; onPress: () => void; value?: string; dot?: boolean; count?: number; tag?: string; locked?: number;
  dim?: boolean; bg?: string; size: number; testID?: string; flicker?: boolean; wobble?: boolean;
}) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} testID={testID}>
      <View style={[st.railItem, { width: size + 8 }]}>
        <Wobble on={!!wobble}>
          <View style={[st.railBtn, shadow.soft, { width: size, height: size, backgroundColor: bg ?? colors.surface }, (dim || locked) ? { opacity: 0.6 } : null]}>
            {locked ? <Icon name="lock" size={size * 0.42} color={colors.inkSoft} /> : <Flicker on={!!flicker}><Icon name={icon} size={value || tag ? size * 0.42 : size * 0.5} color={iconColor} /></Flicker>}
            {value ? <T size={type.label} weight="black" color={colors.ink} style={st.railValue}>{value}</T> : null}
            {tag ? <View style={st.railTag}><T size={type.caption} weight="black" color={colors.white}>{tag}</T></View> : null}
            {count ? <Dot count={count} /> : dot ? <Dot /> : null}
          </View>
        </Wobble>
        <T size={type.caption} weight="black" color={colors.ink} center lines={1} style={st.railLabel}>{locked ? t('lv_short', { n: locked }) : label}</T>
      </View>
    </Press>
  );
}

function DockButton({ icon, label, onPress, lockedAt, sub, testID }: { icon: IconName; label: string; onPress: () => void; lockedAt?: number | null; sub?: string; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} disabled={!!lockedAt} style={{ flex: 1 }} testID={testID} scaleTo={0.9}>
      <View style={[st.dockBtn, lockedAt ? { opacity: 0.5 } : null]}>
        <View>
          <Icon name={icon} size={26} color={lockedAt ? colors.inkSoft : colors.accent} />
          {lockedAt ? <View style={st.dockLock}><Icon name="lock" size={11} color={colors.white} /></View> : null}
        </View>
        <T size={type.caption} weight="bold" color={colors.ink} lines={1}>{lockedAt ? t('lv_short', { n: lockedAt }) : label}</T>
        {sub && sub !== "0" && !lockedAt ? <View style={st.dockSub}><T size={9} weight="black" color={colors.white}>{sub}</T></View> : null}
      </View>
    </Press>
  );
}

/** A slow flicker for the streak flame. Runs only while home is on screen. */
function Flicker({ on, children }: { on: boolean; children: React.ReactNode }) {
  const f = useSharedValue(0);
  useEffect(() => {
    f.value = on ? withRepeat(withSequence(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 480, easing: Easing.inOut(Easing.sin) })), -1) : withTiming(0);
  }, [on, f]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * f.value }, { rotate: `${-4 + 8 * f.value}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

function Wobble({ on, children }: { on: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = on ? withRepeat(withSequence(withTiming(-1, { duration: 90 }), withTiming(1, { duration: 90 }), withTiming(-1, { duration: 90 }), withTiming(0, { duration: 90 }), withTiming(0, { duration: 1600 })), -1) : withTiming(0);
  }, [on, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 8}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  veilTop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: colors.bg, opacity: 0.35 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rail: { position: 'absolute' },
  railItem: { alignItems: 'center', gap: 4 },
  railBtn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  railLabel: { textShadowColor: colors.bg, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  railValue: { marginTop: -2, lineHeight: 15 },
  railTag: { marginTop: 1, height: 17, paddingHorizontal: 6, borderRadius: 9, backgroundColor: colors.correct, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', paddingHorizontal: 12, gap: 10 },
  rewardChip: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.pill, height: 40, paddingLeft: 10, paddingRight: 14, maxWidth: '100%' },
  playCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, gap: 12 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterIcon: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dock: { position: 'absolute', flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 4, alignItems: 'center' },
  dockBtn: { alignItems: 'center', justifyContent: 'center', gap: 2, height: sizes.dock },
  dockLock: { position: 'absolute', right: -6, bottom: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
  dockSub: { position: 'absolute', top: 4, right: 8, minWidth: 18, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  missionReward: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 64, justifyContent: 'flex-end' },
  chestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.goldSoft, borderRadius: radius.lg, padding: 10 },
  freeHero: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  freeLeft: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  freePip: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.track },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.chip, borderRadius: radius.md, padding: 12 },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  levelNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  levelItems: { flex: 1, gap: 2 },
  levelItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
