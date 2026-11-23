// Home: one screen, one thing to do.
// - The world map is the backdrop, framed on the current chapter (drawn once, it never animates).
// - Top bar: level (tap for the coming rewards), coins (tap for the shop), settings.
// - One "Today" button: streak, daily reward, Daily Challenge and missions as a short checklist in one sheet.
// - Bottom: the chapter with the one big PLAY button and the next goal, then Journey / Modes / Shop.
// A system is not on screen until the player has unlocked it (balance.unlocks): a new player sees PLAY and nothing else.
import { router, useIsFocused } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Deferred, BigButton, Dot, PopIn, Press, ProgressBar, Sheet, SheetTitle, SmallButton, T } from '../components/ui';
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
import { ExploreMap, regionCam } from '../map/ExploreMap';
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
  // the map's window: between the top bar and the stage card. The chapter's part of the world is framed in it
  const navOn = todayOn || modesOn || shopOn;
  const mapTop = insets.top + 8 + sizes.hud + 8;
  const mapBottom = SH - (insets.bottom + 12 + (navOn ? sizes.dock + 10 : 0) + STAGE_H);
  const mapBox: Box = useMemo(() => ({ fx: SW / 2, fy: (mapTop + mapBottom) / 2, fw: SW * 0.9, fh: (mapBottom - mapTop) * 0.86, W: SW }), [SW, mapTop, mapBottom]);
  // memoised: a new camera object would rebuild the backdrop's paths on every render
  const mapCam: Cam = useMemo(() => {
    if (topic === 'usa') return { ...neutralCam('usa'), w: neutralCam('usa').w * 0.9 };
    if (topic === 'world') return { ...neutralCam('world'), w: neutralCam('world').w * 0.62 };
    return regionCam(topic, mapBox);
  }, [topic, mapBox]);

  // the player may drag and zoom the map; a button brings it back, and so does coming back to the menu
  const [mapMoved, setMapMoved] = useState(false);
  const [mapReset, setMapReset] = useState(0);
  const movedRef = useRef(false);
  movedRef.current = mapMoved;
  useEffect(() => {
    if (focused && movedRef.current) setMapReset((k) => k + 1);
  }, [focused]);

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
    // a new player's first PLAY is the guided first round (easy, famous places, no timer pressure)
    if (!save.ftue.firstRoundDone) return router.push({ pathname: '/play', params: { mode: 'first', nonce: String(Date.now()) } });
    if (hearts.count <= 0 && balance.hearts.enabled) return router.push('/journey');
    router.push({ pathname: '/play', params: { mode: 'journey', level: lv.id, nonce: String(Date.now()) } });
  };

  const cal = balance.daily.loginCalendar;
  const loginIdx = save.login.next % cal.length;

  return (
    <View style={[StyleSheet.absoluteFill, st.bg]}>
      <ExploreMap width={SW} height={SH} box={mapBox} scene={scene} home={mapCam} theme={theme} resetKey={mapReset} onMoved={setMapMoved} safeTop={mapTop} safeBottom={mapBottom - 54} />

      {/* top bar: what the player has */}
      <View style={[st.top, { paddingTop: insets.top + 8, width: W }]} pointerEvents="box-none">
        <LevelBadge level={save.level} xp={save.xp} need={need} onPress={() => setSheet('level')} testID="home-level" />
        <View style={st.topRight}>
          <CoinPill value={save.coins} bumpKey={coinBump} onPress={shopOn ? () => router.push({ pathname: '/shop', params: { tab: 'coins' } }) : undefined} testID="home-coins" />
          <IconButton icon="cog" onPress={() => router.push('/settings')} testID="home-settings" />
        </View>
      </View>

      {/* bottom: one card that says what is next and holds the one PLAY, then the places to go */}
      <View style={[st.bottom, { bottom: insets.bottom + 12, width: W }]} pointerEvents="box-none">
        {mapMoved ? (
          <PopIn style={st.recenter}>
            <IconButton icon="image-filter-center-focus" onPress={() => setMapReset((k) => k + 1)} testID="home-recenter" />
          </PopIn>
        ) : null}
        <View style={[st.stage, shadow.card]}>
          <Press onPress={() => router.push('/journey')} scaleTo={0.98} testID="home-chapter">
            <View style={st.stageRow}>
              <View style={st.stageIcon}><Icon name={ch.icon as IconName} size={24} color={colors.accent} /></View>
              <View style={{ flex: 1 }}>
                <T size={type.heading} weight="black" lines={1}>{t(`chapter_${ch.id}` as never)}</T>
                <T size={type.caption} weight="bold" color={colors.inkSoft} lines={1}>{t('level_short', { n: lv.index + 1 })}</T>
              </View>
              {balance.hearts.enabled && hearts.count < balance.hearts.max ? (
                <View style={st.stageStat}><Icon name="heart" size={16} color={colors.heart} /><T size={type.label} weight="black">{String(hearts.count)}</T></View>
              ) : null}
              <View style={st.stageStat}><Icon name="star" size={16} color={colors.gold} /><T size={type.label} weight="black">{`${chStars.have}/${chStars.max}`}</T></View>
              <Icon name="chevron-right" size={22} color={colors.inkSoft} />
            </View>
          </Press>
          {/* the next thing to reach, as a bar that fills */}
          <View style={st.goal}>
            <View style={{ flex: 1 }}><ProgressBar value={goal && goal.needStars > 0 ? 1 - goal.needStars / Math.max(1, CHAPTERS[goal.chapterIndex].starsToOpen) : need ? save.xp / need : 1} height={6} color={colors.gold} /></View>
            <Icon name={goal && goal.needStars > 0 ? 'lock' : 'star-four-points'} size={13} color={colors.inkSoft} />
            <T size={type.caption} weight="bold" color={colors.inkSoft} lines={1} style={{ flexShrink: 1 }}>{goalText}</T>
          </View>
          <BigButton label={t('play')} icon={lv.boss ? 'crown' : 'play'} onPress={playJourney} breathe={focused && !sheet} testID="home-play" height={PLAY_H} />
        </View>
        {/* a new player has one button, PLAY; the bar appears once there is more than one place to go */}
        {navOn ? (
          <View style={[st.nav, shadow.soft]}>
            {todayOn ? (
              <NavButton icon="fire" color={streak > 0 ? colors.flame : colors.inkSoft} label={t('today')} value={streak > 0 ? String(streak) : undefined} count={todayCount}
                flicker={streak > 0 && focused && !sheet} onPress={() => setSheet('today')} testID="home-today" />
            ) : null}
            <NavButton icon="map-marker-path" color={colors.accent} label={t('journey')} onPress={() => router.push('/journey')} testID="home-journey" />
            {modesOn ? <NavButton icon="gamepad-variant" color={colors.gold} label={t('modes')} onPress={() => setSheet('modes')} testID="home-modes" /> : null}
            {shopOn ? <NavButton icon="store" color={colors.correct} label={t('shop')} onPress={() => router.push('/shop')} testID="home-shop" /> : null}
          </View>
        ) : null}
      </View>

      {/* Today: what resets every day, shown as things to tap, not text to read */}
      {sheet === 'today' ? (
        <Sheet onClose={() => setSheet(null)} testID="today-sheet">
          <SheetTitle title={streak > 0 ? t('streak_day', { n: streak }) : t('today')} icon={<Icon name="fire" size={28} color={streak > 0 ? colors.flame : colors.inkSoft} />} onClose={() => setSheet(null)} />
          {atRisk || repairable ? (
            <View style={st.alert}>
              <Icon name="fire-alert" size={20} color={colors.flame} />
              <T size={type.label} weight="black" color={colors.flame} style={{ flex: 1 }} lines={1}>{repairable ? t('streak_broken', { n: save.streak.broken?.count ?? 0 }) : t('streak_today')}</T>
              {repairable ? (
                <SmallButton label={save.coins >= balance.daily.streakRepairCoins ? String(balance.daily.streakRepairCoins) : t('streak_repair')}
                  iconNode={save.coins >= balance.daily.streakRepairCoins ? <Coin size={16} /> : <Icon name="play-circle" size={16} color={colors.white} />}
                  color={colors.flame} textColor={colors.white} onPress={onRepair} testID="home-repair" style={{ height: 36 }} />
              ) : null}
            </View>
          ) : null}

          {/* 7 days: today glows and is tapped to claim */}
          <View style={st.days}>
            {cal.map((c, i) => {
              const last = i === cal.length - 1;
              const claimedToday = !loginClaimable && save.login.lastDay === today;
              const done = i < loginIdx || (claimedToday && i === (loginIdx + cal.length - 1) % cal.length);
              const now = loginClaimable && i === loginIdx;
              return (
                <Press key={i} onPress={onLogin} disabled={!now} scaleTo={0.9} style={last ? { flex: 1.6 } : { flex: 1 }} testID={now ? 'login-claim' : undefined}>
                  <Wiggle on={now}>
                    <View style={[st.day, now && st.dayNow, done && st.dayDone]}>
                      {done ? <Icon name="check-bold" size={20} color={colors.correct} />
                        : last ? <Icon name="treasure-chest" size={28} color={colors.goldDark} />
                        : <Coin size={20} />}
                      <T size={10} weight="black" color={now ? colors.white : colors.inkSoft}>{last ? t('day_n', { n: 7 }) : fmt(c)}</T>
                    </View>
                  </Wiggle>
                </Press>
              );
            })}
          </View>

          {/* Daily Challenge: one tile, one button. (The sheet is built a part per frame, so opening it never stalls.) */}
          <Deferred frames={1}>
          <View style={[st.challenge, dailyDone && { backgroundColor: colors.correctSoft }]}>
            <Icon name={dailyDone ? 'calendar-check' : 'calendar-star'} size={34} color={dailyDone ? colors.correct : colors.white} />
            <View style={{ flex: 1 }}>
              <T size={type.heading} weight="black" color={dailyDone ? colors.ink : colors.white} lines={1}>{t('daily_challenge')}</T>
              {dailyDone ? <Countdown ms={msToMidnight(now)} render={(time) => `${save.daily.results[today]?.correct ?? 0}/10 · ${time}`} /> : null}
            </View>
            {!dailyUnlocked ? <View style={st.lockTag}><Icon name="lock" size={16} color={colors.white} /><T size={type.label} weight="black" color={colors.white}>{t('lv_short', { n: balance.unlocks.dailyChallenge })}</T></View>
              : dailyDone ? <Icon name="check-circle" size={30} color={colors.correct} />
              : <Press onPress={playDaily} testID="daily-play" scaleTo={0.9}><View style={st.playRound}><Icon name="play" size={28} color={colors.accent} /></View></Press>}
          </View>
          </Deferred>

          {/* missions: three tiles, icon + count + reward; tap a full one to claim */}
          {missionsOn ? (
            <Deferred frames={2}>
            <View style={st.missionTiles}>
              {save.missions.list.map((m, i) => {
                const ready = !m.claimed && m.progress >= m.target;
                const def = MISSION_ICONS[m.id] ?? { icon: 'check-circle' as IconName, color: colors.accent };
                return (
                  <Press key={m.id} onPress={() => ready && onClaimMission(m.id, SH * 0.6)} disabled={!ready} style={{ flex: 1 }} scaleTo={0.92} testID={`mission-claim-${i}`}>
                    <Wiggle on={ready}>
                      <View style={[st.mission, ready && st.missionReady, m.claimed && st.missionDone]}>
                        <Icon name={m.claimed ? 'check-circle' : def.icon} size={30} color={ready ? colors.white : m.claimed ? colors.correct : def.color} />
                        <T size={type.heading} weight="black" color={ready ? colors.white : colors.ink}>{`${Math.min(m.progress, m.target)}/${m.target}`}</T>
                        <T size={10} weight="bold" color={ready ? colors.white : colors.inkSoft} center lines={1}>{t(`ms_${m.id}` as never)}</T>
                        <View style={st.missionBar}><ProgressBar value={m.progress / m.target} color={ready ? colors.white : colors.gold} height={5} /></View>
                        <View style={[st.missionReward, ready && { backgroundColor: colors.white }]}>
                          <Coin size={14} />
                          <T size={type.caption} weight="black" color={colors.goldDark}>{ready ? t('claim') : String(balance.daily.missionCoins)}</T>
                        </View>
                      </View>
                    </Wiggle>
                  </Press>
                );
              })}
            </View>
            </Deferred>
          ) : null}
          {missionsOn && canClaimMissionChest(save) ? <SmallButton label={t('chest_open')} icon="treasure-chest" color={colors.gold} textColor={colors.white} onPress={onMissionChest} testID="mission-chest" /> : null}
        </Sheet>
      ) : null}

      {/* Modes: two picture tiles, tap one to play */}
      {sheet === 'modes' ? (
        <Sheet onClose={() => setSheet(null)} testID="modes-sheet">
          <SheetTitle title={t('modes')} icon={<Icon name="gamepad-variant" size={26} color={colors.accent} />} onClose={() => setSheet(null)} />
          <Deferred frames={1}>
          <View style={st.modeRow}>
            <Press onPress={() => { setSheet(null); router.push('/quick'); }} style={{ flex: 1 }} scaleTo={0.94} testID="home-quick">
              <View style={[st.modeTile, { backgroundColor: '#F59E0B' }]}>
                <View style={st.modeIcon}><Icon name="lightning-bolt" size={44} color="#F59E0B" /></View>
                <T size={type.heading} weight="black" color={colors.white} center>{t('quick_play')}</T>
                <View style={st.modeFacts}><Icon name="earth" size={16} color={colors.white} /><Icon name="flag" size={16} color={colors.white} /><Icon name="flag-variant" size={16} color={colors.white} /></View>
              </View>
            </Press>
            <Press onPress={() => { setSheet(null); router.push({ pathname: '/play', params: { mode: 'survival', nonce: String(Date.now()) } }); }}
              disabled={save.level < balance.unlocks.survival} style={{ flex: 1 }} scaleTo={0.94} testID="home-survival">
              <View style={[st.modeTile, { backgroundColor: save.level < balance.unlocks.survival ? colors.disabled : '#334155' }]}>
                <View style={st.modeIcon}><Icon name={save.level < balance.unlocks.survival ? 'lock' : 'skull'} size={44} color="#334155" /></View>
                <T size={type.heading} weight="black" color={colors.white} center>{t('survival')}</T>
                {save.level < balance.unlocks.survival ? (
                  <T size={type.label} weight="black" color={colors.white}>{t('lv_short', { n: balance.unlocks.survival })}</T>
                ) : (
                  <View style={st.modeFacts}>
                    {[0, 1, 2].map((i) => <Icon key={i} name="heart" size={16} color="#F87171" />)}
                    {save.stats.survivalBest ? <><Icon name="trophy" size={16} color="#FCD34D" /><T size={type.label} weight="black" color={colors.white}>{String(save.stats.survivalBest)}</T></> : null}
                  </View>
                )}
              </View>
            </Press>
          </View>
          </Deferred>
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
          {comingRewards(save.level, 3).map((r, i) => (
            <Deferred key={r.level} frames={i + 1}>
            <View style={st.levelRow}>
              <View style={st.levelNum}><T size={type.label} weight="black" color={colors.white}>{String(r.level)}</T></View>
              <View style={st.levelItems}>
                {r.items.map((it, i) => (
                  <View key={i} style={st.levelItem}><RewardIcon name={it.icon} size={18} /><T size={type.label} weight="bold" lines={1}>{it.label}</T></View>
                ))}
              </View>
              <T size={type.caption} weight="bold" color={colors.inkSoft}>{`${fmt(Math.max(0, totalXpTo(r.level) - totalXpTo(save.level) - save.xp))} XP`}</T>
            </View>
            </Deferred>
          ))}
        </Sheet>
      ) : null}

      {celebrate ? <Celebration spec={celebrate} onClose={() => { setCelebrate(null); setCoinBump((b) => b + 1); }} /> : null}
    </View>
  );
}

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

/** One place to go, in the bar at the bottom: a small coloured icon and its name. Quiet on purpose, so the one
 *  loud thing on the menu is PLAY. */
function NavButton({ icon, color, label, value, count, flicker, onPress, testID }: {
  icon: IconName; color: string; label: string; value?: string; count?: number; flicker?: boolean; onPress: () => void; testID?: string;
}) {
  const st = useStyles(make_st);
  return (
    <Press onPress={onPress} style={{ flex: 1 }} testID={testID} scaleTo={0.9}>
      <View style={st.navBtn}>
        {/* every icon sits in the same box in the middle of its button; the streak number and the red count hang
            beside it without moving it */}
        <View style={st.navIcon}>
          <Flicker on={!!flicker}><Icon name={icon} size={NAV_ICON} color={color} /></Flicker>
          {value ? <View style={st.navValue}><T size={type.label} weight="black" color={color}>{value}</T></View> : null}
          {count ? <Dot style={st.navDot} /> : null}
        </View>
        <T size={type.caption} weight="black" lines={1}>{label}</T>
      </View>
    </Press>
  );
}

/** A short shake every two seconds: "this one is ready". Only while it is on screen. */
function Wiggle({ on, children }: { on: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.value = on ? withRepeat(withSequence(withTiming(-1, { duration: 80 }), withTiming(1, { duration: 80 }), withTiming(-1, { duration: 80 }), withTiming(0, { duration: 80 }), withTiming(0, { duration: 1700 })), -1) : withTiming(0);
  }, [on, r]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value * 6}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

const MISSION_ICONS: Record<string, { icon: IconName; color: string }> = {
  correct_answers: { icon: 'check-circle', color: '#16A34A' },
  correct_answers_big: { icon: 'check-decagram', color: '#16A34A' },
  play_rounds: { icon: 'play-circle', color: '#7C3AED' },
  three_stars: { icon: 'star', color: '#F59E0B' },
  combo: { icon: 'fire', color: '#F97316' },
  discover: { icon: 'book-open-variant', color: '#7C3AED' },
  flags_right: { icon: 'flag', color: '#EF4444' },
  daily_challenge: { icon: 'calendar-star', color: '#7C3AED' },
  journey_levels: { icon: 'map-marker-path', color: '#7C3AED' },
  quick_rounds: { icon: 'lightning-bolt', color: '#F59E0B' },
  survival_correct: { icon: 'skull', color: '#334155' },
};

/** A slow flicker for the streak flame. Runs only while home is on screen. */
function Flicker({ on, children }: { on: boolean; children: React.ReactNode }) {
  const f = useSharedValue(0.5);
  useEffect(() => {
    // at rest (0.5) the icon is upright and its own size, so it lines up with the icons next to it
    f.value = on ? withRepeat(withSequence(withTiming(1, { duration: 520, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 480, easing: Easing.inOut(Easing.sin) })), -1) : withTiming(0.5);
  }, [on, f]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * (f.value - 0.5) }, { rotate: `${8 * (f.value - 0.5)}deg` }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

// the stage card's measures: the map's window is worked out from them
const STAGE_PAD = 12;
const STAGE_GAP = 10;
const STAGE_ROW = 44;
const STAGE_GOAL = 16;
const PLAY_H = 72;
const NAV_ICON = 28;
const STAGE_H = STAGE_PAD * 2 + STAGE_ROW + STAGE_GAP + STAGE_GOAL + STAGE_GAP + PLAY_H + 8;

const make_st = (colors: Palette) => StyleSheet.create({
  bg: { backgroundColor: colors.bg, alignItems: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12 },
  topRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bottom: { position: 'absolute', paddingHorizontal: 12, gap: 10 },
  recenter: { alignSelf: 'flex-end' },
  stage: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: STAGE_PAD, gap: STAGE_GAP },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: STAGE_ROW },
  stageIcon: { width: STAGE_ROW, height: STAGE_ROW, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stageStat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  goal: { flexDirection: 'row', alignItems: 'center', gap: 6, height: STAGE_GOAL },
  nav: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, height: sizes.dock, paddingHorizontal: 4 },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 },
  navIcon: { width: NAV_ICON, height: NAV_ICON, alignItems: 'center', justifyContent: 'center' },
  navValue: { position: 'absolute', left: NAV_ICON + 1, bottom: -1 },
  navDot: { position: 'absolute', top: -1, left: NAV_ICON - 7, right: 'auto' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chapterIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.goldSoft, borderRadius: radius.md, paddingHorizontal: 10, minHeight: 44 },
  days: { flexDirection: 'row', gap: 5 },
  day: { height: 64, borderRadius: radius.md, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayNow: { backgroundColor: colors.gold, borderBottomWidth: 4, borderBottomColor: colors.goldDark },
  dayDone: { backgroundColor: colors.correctSoft },
  challenge: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.accent, borderRadius: radius.lg, paddingHorizontal: 14, height: 70, borderBottomWidth: 4, borderBottomColor: 'rgba(15,23,42,0.22)' },
  playRound: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  lockTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  missionTiles: { flexDirection: 'row', gap: 8 },
  mission: { borderRadius: radius.lg, backgroundColor: colors.chip, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, gap: 3 },
  missionReady: { backgroundColor: colors.correct, borderBottomWidth: 4, borderBottomColor: 'rgba(15,23,42,0.22)' },
  missionDone: { opacity: 0.6 },
  missionBar: { alignSelf: 'stretch', paddingHorizontal: 4 },
  missionReward: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surface, borderRadius: 99, paddingHorizontal: 8, height: 22, marginTop: 2 },
  modeRow: { flexDirection: 'row', gap: 10 },
  modeTile: { borderRadius: radius.xl, alignItems: 'center', paddingVertical: 18, gap: 8, borderBottomWidth: 5, borderBottomColor: 'rgba(15,23,42,0.25)' },
  modeIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  modeFacts: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 20 },
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
