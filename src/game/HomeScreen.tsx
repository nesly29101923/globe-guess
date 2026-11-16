// Home: one screen, one thing to do.
// - The world map is the backdrop, framed on the current chapter (drawn once, it never animates).
// - Top bar: level (tap for the coming rewards), coins (tap for the shop), settings.
// - One "Today" button: streak, daily reward, Daily Challenge and missions as a short checklist in one sheet.
// - Bottom: the chapter with the one big PLAY button and the next goal, then Journey / Modes / Shop.
// A system is not on screen until the player has unlocked it (balance.unlocks): a new player sees PLAY and nothing else.
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
import { chapterStars, currentLevel, heartsNow, nextChapterGoal, syncHearts } from '../logic/journey';
import { nextReward, rewardAt, totalXpTo, xpToNext } from '../logic/progression';
import { canRepair, displayedStreak, repair, streakAtRisk } from '../logic/streak';
import { msToMidnight } from '../logic/time';
import type { Topic } from '../config/levels';
import { neutralCam, type Box, type Cam } from '../map/camera';
import { StaticMap, regionCam } from '../map/StaticMap';
import { ads } from '../services/ads';
import type { SaveState } from '../logic/save';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { layout, mapThemes, radius, shadow, sizes, type, type Palette } from '../theme';
import { useIsDark, usePalette, useStyles } from '../theme/usePalette';
import { showPendingNotificationAsk } from './notify';
import { rewardHeadline, rewardItems, type RewardItem } from './rewardItems';

type SheetKind = 'today' | 'modes' | 'level' | null;

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
      const h = setTimeout(() => setSheet('today'), 600);
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
  const loginClaimable = canClaimLogin(save, today);
  const missionsOn = save.level >= balance.unlocks.missions;
  const missionsReady = missionsOn ? save.missions.list.filter((m) => !m.claimed && m.progress >= m.target).length + (canClaimMissionChest(save) ? 1 : 0) : 0;
  const repairable = canRepair(save, today);
  const chStars = chapterStars(save, ch.id);
  const todayOn = dailyUnlocked || save.totalRounds >= 2;
  const modesOn = save.level >= balance.unlocks.quickPlay;
  const shopOn = save.level >= balance.unlocks.shop;
  // what is waiting in the Today sheet: shown as a number on its button
  const todayCount = (loginClaimable ? 1 : 0) + (dailyUnlocked && !dailyDone ? 1 : 0) + missionsReady + (repairable ? 1 : 0);

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
    if (!r.coins) return;
    update(() => r.state);
    analytics.log('daily_reward_claimed', { day: r.dayIndex + 1 });
    analytics.log('coins_earned', { source: 'login', amount: r.coins, balance: r.state.coins });
    if (r.chest) setSheet(null);
    if (r.chest) setCelebrate({ kind: 'chest', icon: 'treasure-chest', title: t('login_day', { n: 7 }), rewards: [{ icon: 'coin', label: `+${fmt(r.coins)}` }, { icon: 'circle-half-full', label: `+${balance.daily.loginDay7Powerups}` }, { icon: 'snowflake', label: `+${balance.daily.loginDay7Powerups}` }] });
    else flyCoinsFrom(SH * 0.3, 8);
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

  const rail = compact ? 52 : sizes.rail;
  const cal = balance.daily.loginCalendar;
  const loginIdx = save.login.next % cal.length;

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <HomeMap width={SW} height={SH} box={mapBox} scene={scene} topic={scene === 'usa' ? 'usa' : topic} cam={mapCam} theme={theme} />

      {/* top bar */}
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]}>
        <LevelBadge level={save.level} xp={save.xp} need={need} onPress={() => setSheet('level')} testID="home-level" />
        <View style={st.topRight}>
          <CoinPill value={save.coins} bumpKey={coinBump} onPress={shopOn ? () => router.push({ pathname: '/shop', params: { tab: 'coins' } }) : undefined} testID="home-coins" />
          <IconButton icon="cog" onPress={() => router.push('/settings')} testID="home-settings" />
        </View>
      </View>

      {/* the one side button: everything that resets daily */}
      {todayOn ? (
        <View style={[st.rail, { top: insets.top + 8 + sizes.hud + 16, left: (SW - W) / 2 + 12 }]}>
          <Press onPress={() => setSheet('today')} testID="home-today">
            <View style={st.railItem}>
              <View style={[st.railBtn, shadow.soft, { width: rail, height: rail }]}>
                <Flicker on={streak > 0 && focused && !sheet}><Icon name="fire" size={rail * 0.42} color={streak > 0 ? colors.flame : colors.inkSoft} /></Flicker>
                <T size={type.label} weight="black" style={st.railValue}>{String(streak)}</T>
                {todayCount ? <Dot count={todayCount} /> : null}
              </View>
              <View style={st.railLabel}><T size={type.caption} weight="black">{t('today')}</T></View>
            </View>
          </Press>
        </View>
      ) : null}

      {/* chapter + PLAY + the other places to go */}
      <View style={[st.bottom, { bottom: insets.bottom + 12, width: W }]} pointerEvents="box-none">
        <View style={[st.playCard, shadow.card]}>
          <View style={st.chapterRow}>
            <View style={st.chapterIcon}><Icon name={ch.icon as IconName} size={24} color={colors.accent} /></View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={st.rowBetween}>
                <T size={type.heading} weight="black" lines={1} style={{ flexShrink: 1 }}>{t(`chapter_${ch.id}` as never)}</T>
                <View style={st.miniStats}>
                  {balance.hearts.enabled && hearts.count < balance.hearts.max ? (
                    <>
                      <Icon name="heart" size={15} color={colors.heart} />
                      <T size={type.label} weight="black">{String(hearts.count)}</T>
                      <View style={{ width: 6 }} />
                    </>
                  ) : null}
                  <Icon name="star" size={15} color={colors.gold} />
                  <T size={type.label} weight="black">{`${chStars.have}/${chStars.max}`}</T>
                </View>
              </View>
              <ProgressBar value={chStars.have / chStars.max} color={colors.gold} height={6} />
            </View>
          </View>
          <BigButton label={`${t('play')} · ${t('level_short', { n: lv.index + 1 })}`} icon={lv.boss ? 'crown' : 'play'} onPress={playJourney} breathe={focused && !sheet} testID="home-play" />
          <T size={type.label} weight="bold" color={colors.accent} center lines={1}>{goalText}</T>
        </View>
        <View style={st.dock}>
          <DockButton icon="map-marker-path" label={t('journey')} onPress={() => router.push('/journey')} testID="home-journey" />
          {modesOn ? <DockButton icon="lightning-bolt" label={t('modes')} onPress={() => setSheet('modes')} testID="home-modes" /> : null}
          {shopOn ? <DockButton icon="store" label={t('shop')} onPress={() => router.push('/shop')} testID="home-shop" /> : null}
        </View>
      </View>

      {/* Today: a checklist of what resets every day */}
      {sheet === 'today' ? (
        <Sheet onClose={() => setSheet(null)} testID="today-sheet">
          <SheetTitle title={streak > 0 ? t('streak_day', { n: streak }) : t('today')} icon={<Icon name="fire" size={28} color={streak > 0 ? colors.flame : colors.inkSoft} />} onClose={() => setSheet(null)} />
          <T size={type.label} weight="bold" color={atRisk ? colors.flame : colors.inkSoft}>
            {streak > 0 && save.streak.lastDay === today ? t('streak_tomorrow') : t('streak_today')}
            {save.streak.freezes > 0 ? ` · ${t('streak_freezes', { n: save.streak.freezes })}` : ''}
          </T>
          {repairable ? (
            <Row icon="fire" color={colors.wrong} title={t('streak_broken', { n: save.streak.broken?.count ?? 0 })}>
              <SmallButton label={save.coins >= balance.daily.streakRepairCoins ? String(balance.daily.streakRepairCoins) : t('streak_repair')}
                iconNode={save.coins >= balance.daily.streakRepairCoins ? <Coin size={18} /> : <Icon name="play-circle" size={18} color={colors.white} />}
                color={colors.flame} textColor={colors.white} onPress={onRepair} testID="home-repair" />
            </Row>
          ) : null}

          <Row icon="gift" color={colors.wrong} title={t('login_title')} sub={
            <View style={st.pips}>
              {cal.map((_, i) => {
                const done = i < loginIdx || (!loginClaimable && save.login.lastDay === today && i === (loginIdx + cal.length - 1) % cal.length);
                return <View key={i} style={[st.pip, done ? { backgroundColor: colors.correct } : loginClaimable && i === loginIdx ? { backgroundColor: colors.gold } : null, i === cal.length - 1 && st.pipLast]} />;
              })}
              <T size={type.caption} weight="bold" color={colors.inkSoft}>{t('login_day', { n: Math.min(cal.length, loginIdx + (loginClaimable ? 1 : 0)) || 1 })}</T>
            </View>
          }>
            {loginClaimable
              ? <SmallButton label={`+${fmt(cal[loginIdx])}`} iconNode={<Coin size={18} />} color={colors.correct} textColor={colors.white} onPress={onLogin} testID="login-claim" />
              : <Icon name="check-circle" size={26} color={colors.correct} />}
          </Row>

          <Row icon="calendar-star" color={colors.accent} title={t('daily_challenge')}
            sub={!dailyUnlocked ? t('daily_locked', { n: balance.unlocks.dailyChallenge }) : dailyDone ? <Countdown ms={msToMidnight(now)} render={(time) => `${save.daily.results[today]?.correct ?? 0}/10 · ${t('daily_done', { time })}`} /> : t('daily_challenge_desc')}>
            {!dailyUnlocked ? <Icon name="lock" size={22} color={colors.inkSoft} />
              : dailyDone ? <Icon name="check-circle" size={26} color={colors.correct} />
              : <SmallButton label={t('play_short')} icon="play" color={colors.accent} textColor={colors.white} onPress={playDaily} testID="daily-play" />}
          </Row>

          {missionsOn ? (
            <View style={st.missions}>
              <View style={st.rowBetween}>
                <T size={type.label} weight="black" color={colors.inkSoft}>{t('missions').toUpperCase()}</T>
                <Countdown ms={msToMidnight(now)} render={(time) => time} />
              </View>
              {save.missions.list.map((m, i) => {
                const ready = !m.claimed && m.progress >= m.target;
                return (
                  <View key={m.id} style={st.missionRow}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <T size={type.label} weight="bold" lines={1}>{t(`mission_${m.id}` as never, { n: m.target })}</T>
                      <ProgressBar value={m.progress / m.target} color={m.progress >= m.target ? colors.correct : colors.gold} height={6} />
                    </View>
                    {m.claimed ? <View style={st.missionRight}><Icon name="check-circle" size={22} color={colors.correct} /></View>
                      : ready ? <SmallButton label={`+${balance.daily.missionCoins}`} iconNode={<Coin size={16} />} color={colors.correct} textColor={colors.white} onPress={() => onClaimMission(m.id, SH * 0.5 + i * 50)} testID={`mission-claim-${i}`} style={st.missionRight} />
                      : <View style={st.missionRight}><T size={type.label} weight="black" color={colors.inkSoft}>{`${Math.min(m.progress, m.target)}/${m.target}`}</T></View>}
                  </View>
                );
              })}
              {canClaimMissionChest(save) ? <SmallButton label={t('all_missions_chest')} icon="treasure-chest" color={colors.gold} textColor={colors.white} onPress={onMissionChest} testID="mission-chest" /> : null}
            </View>
          ) : null}
        </Sheet>
      ) : null}

      {/* Modes */}
      {sheet === 'modes' ? (
        <Sheet onClose={() => setSheet(null)} testID="modes-sheet">
          <SheetTitle title={t('modes')} icon={<Icon name="lightning-bolt" size={26} color={colors.gold} />} onClose={() => setSheet(null)} />
          <Row icon="lightning-bolt" color={colors.gold} title={t('quick_play')} sub={t('quick_desc')}>
            <SmallButton label={t('play_short')} icon="play" color={colors.accent} textColor={colors.white} onPress={() => { setSheet(null); router.push('/quick'); }} testID="home-quick" />
          </Row>
          <Row icon="skull" color={colors.ink} title={t('survival')} sub={save.level < balance.unlocks.survival ? t('daily_locked', { n: balance.unlocks.survival }) : save.stats.survivalBest ? `${t('survival_desc')} · ${t('best')} ${save.stats.survivalBest}` : t('survival_desc')}>
            {save.level < balance.unlocks.survival ? <Icon name="lock" size={22} color={colors.inkSoft} />
              : <SmallButton label={t('play_short')} icon="play" color={colors.accent} textColor={colors.white} onPress={() => { setSheet(null); router.push({ pathname: '/play', params: { mode: 'survival', nonce: String(Date.now()) } }); }} testID="home-survival" />}
          </Row>
        </Sheet>
      ) : null}

      {sheet === 'level' ? (
        <Sheet onClose={() => setSheet(null)} testID="level-sheet">
          <SheetTitle title={t('level_title', { n: save.level })} icon={<Icon name="star-four-points" size={26} color={colors.accent} />} onClose={() => setSheet(null)} />
          <View style={{ gap: 6 }}>
            <T size={type.label} weight="bold" color={colors.inkSoft}>{t('level_info')}</T>
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

      {celebrate ? <Celebration spec={celebrate} onClose={() => { setCelebrate(null); setCoinBump((b) => b + 1); }} /> : null}
    </View>
  );
}

// the backdrop never changes while home is open: memoised so a coin count-up does not touch it
const HomeMap = React.memo(StaticMap);

/** One line of a sheet: icon tile, title, one line of explanation, and the action on the right. */
function Row({ icon, color, title, sub, children }: { icon: IconName; color: string; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <View style={st.row}>
      <View style={st.rowIcon}><Icon name={icon} size={22} color={color} /></View>
      <View style={{ flex: 1, gap: 2 }}>
        <T size={type.body} weight="black" lines={1}>{title}</T>
        {typeof sub === 'string' ? <T size={type.caption} weight="semi" color={colors.inkSoft} lines={2}>{sub}</T> : sub}
      </View>
      {children}
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

function DockButton({ icon, label, onPress, testID }: { icon: IconName; label: string; onPress: () => void; testID?: string }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} style={{ flex: 1 }} testID={testID} scaleTo={0.94}>
      <View style={[st.dockBtn, shadow.soft]}>
        <Icon name={icon} size={22} color={colors.accent} />
        <T size={type.label} weight="black" lines={1}>{label}</T>
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

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rail: { position: 'absolute' },
  railItem: { alignItems: 'center', gap: 4 },
  railBtn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  railValue: { marginTop: -2, lineHeight: 15 },
  railLabel: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 8, height: 18, justifyContent: 'center' },
  bottom: { position: 'absolute', paddingHorizontal: 12, gap: 10 },
  playCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: 14, gap: 12 },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dock: { flexDirection: 'row', gap: 10 },
  dockBtn: { height: sizes.dock - 6, borderRadius: radius.lg, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  pips: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pip: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.track },
  pipLast: { width: 14, height: 14, borderRadius: 4 },
  missions: { gap: 10, backgroundColor: colors.chip, borderRadius: radius.lg, padding: 12 },
  missionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  missionRight: { width: 88, alignItems: 'flex-end' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  levelNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  levelItems: { flex: 1, gap: 2 },
  levelItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
