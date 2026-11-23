import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { bestKeyFor, makeQuiz, type PlayParams } from '../game/quizFactory';
import { PlayScreen, type RoundResult } from '../game/PlayScreen';
import { ResultScreen, type NextAction } from '../game/ResultScreen';
import { t } from '../i18n/strings';
import { interstitialAllowed, noteInterstitial, noteRoundForAds } from '../logic/economy';
import { canPlayJourney, nextLevelAfter } from '../logic/journey';
import { ensureMissions } from '../logic/daily';
import { finishRound, type RoundSummary } from '../logic/round';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { LEVEL_BY_ID } from '../config/levels';
import { maybeAskNotifications, refreshNotifications } from '../game/notify';

export default function PlayRoute() {
  const params = useLocalSearchParams<PlayParams>();
  const p: PlayParams = { mode: params.mode ?? 'first', level: params.level, quick: params.quick, tier: params.tier, nonce: params.nonce };
  const g = useGame.getState();
  const quiz = useMemo(() => makeQuiz(p, g.save, g.today(), g.now()), [params.nonce, params.mode, params.level, params.quick, params.tier]); // eslint-disable-line react-hooks/exhaustive-deps
  const [result, setResult] = useState<{ summary: RoundSummary; coinsBefore: number; grid?: boolean[] } | null>(null);
  // "Play again" / "Next level" replace this route with new params: start fresh
  const [shownFor, setShownFor] = useState(params.nonce);
  if (shownFor !== params.nonce) {
    setShownFor(params.nonce);
    setResult(null);
  }

  const onDone = (r: RoundResult) => {
    const st = useGame.getState();
    const before = st.save;
    const day = st.today();
    const now = st.now();
    const { state, summary } = finishRound(ensureMissions(before, day), { mode: quiz.mode, levelId: quiz.levelId, answers: r.answers, day, now, bestKey: bestKeyFor(p) });
    let next = noteRoundForAds(state);
    if (quiz.mode === 'first') next = { ...next, ftue: { ...next.ftue, firstRoundDone: true } };
    else if (before.ftue.firstRoundDone && !before.ftue.secondRoundDone) next = { ...next, ftue: { ...next.ftue, secondRoundDone: true } };
    const grid = quiz.mode === 'daily' ? r.answers.map((a) => a.correct) : undefined;
    if (quiz.mode === 'daily') {
      next = { ...next, daily: { results: { ...next.daily.results, [day]: { score: summary.score, correct: summary.correct, grid: grid!.map((x) => (x ? '1' : '0')).join('') } } } };
      analytics.log('daily_challenge_end', { correct: summary.correct, score: summary.score, shared: false });
    }
    st.update(() => next);
    st.setSession({ rounds: st.session.rounds + 1 });
    analytics.log(quiz.mode === 'first' ? 'tutorial_round_end' : 'round_end', {
      mode: quiz.mode, level: quiz.levelId ?? null, correct: summary.correct, stars: summary.stars, score: summary.score,
      duration: Math.round(r.durationMs / 1000), powerups_used: r.powerupsUsed, tier: quiz.tierLabel,
    });
    if (summary.coinsTotal) analytics.log('coins_earned', { source: quiz.mode, amount: summary.coinsTotal, balance: next.coins });
    for (const u of summary.levelUps) analytics.log('level_up', { level: u.level });
    if (summary.streak.kind !== 'same_day') analytics.log('streak_updated', { days: next.streak.count, freeze_used: summary.streak.kind === 'froze', broken: summary.streak.kind === 'broken' });
    for (const m of summary.missions) if (m.done) analytics.log('mission_completed', { id: m.id });
    setResult({ summary, coinsBefore: before.coins, grid });
    refreshNotifications();
  };

  /** Natural break: maybe an interstitial (never in the first session, never right after a rewarded ad). */
  const leave = async (go: () => void) => {
    // a good moment just happened: ask for reminders on the next screen (never over the celebration)
    if (result && (result.summary.streak.kind === 'started' || result.summary.streak.kind === 'extended') && quiz.mode !== 'first') maybeAskNotifications('streak');
    const st = useGame.getState();
    const now = st.now();
    const afterRewarded = now - st.session.lastRewardedAt < 5000;
    if (interstitialAllowed(st.save, now, { firstSession: st.session.firstSession, afterRewarded })) {
      st.update((s) => noteInterstitial(s, now));
      await ads.interstitial('between_rounds');
    }
    go();
  };

  const playAgain = (pp: PlayParams) => router.replace({ pathname: '/play', params: { ...pp, nonce: String(Date.now()) } });
  // back to the menu that is already under this screen (replacing would stack a second menu)
  const home = () => (router.canGoBack() ? router.dismissTo('/') : router.replace('/'));

  if (!result) {
    return <PlayScreen key={params.nonce ?? 'x'} quiz={quiz} onDone={onDone} onQuit={home} />;
  }

  const S = result.summary;
  const s = useGame.getState().save;
  let primary: NextAction;
  let secondary: NextAction | undefined = { label: t('home'), go: () => leave(home) };
  if (quiz.mode === 'first') {
    primary = { label: t('continue'), icon: 'play', go: () => playAgain({ mode: 'journey', level: 'world_famous-2' }) };
    secondary = undefined;
  } else if (quiz.mode === 'journey') {
    const nxt = !S.failed && quiz.levelId ? nextLevelAfter(s, quiz.levelId) : null;
    if (!s.ftue.homeSeen && s.ftue.secondRoundDone) {
      primary = { label: t('continue'), icon: 'play', go: home };
      secondary = undefined;
    } else if (nxt) {
      primary = { label: t('next_level'), icon: 'play', go: () => leave(() => playAgain({ mode: 'journey', level: nxt.id })) };
    } else if (S.failed) {
      const ok = canPlayJourney(s, useGame.getState().now());
      primary = ok ? { label: t('try_again'), icon: 'refresh', go: () => leave(() => playAgain({ mode: 'journey', level: quiz.levelId })) } : { label: t('journey'), icon: 'map-marker-path', go: () => leave(() => router.replace('/journey')) };
    } else {
      primary = { label: t('journey'), icon: 'map-marker-path', go: () => leave(() => router.replace('/journey')) };
    }
    void LEVEL_BY_ID;
  } else if (quiz.mode === 'daily') {
    primary = { label: t('home'), icon: 'home', go: () => { maybeAskNotifications('daily'); leave(home); } };
    secondary = undefined;
  } else {
    primary = { label: t('play_again'), icon: 'refresh', go: () => leave(() => playAgain(p)) };
  }

  const onDouble = async () => {
    const ok = await ads.rewarded('double_coins');
    if (ok) {
      const st = useGame.getState();
      const extra = S.coinsTotal - (S.chest ? S.chest.coins : 0);
      st.update((x) => ({ ...x, coins: x.coins + extra }));
      st.setSession({ lastRewardedAt: st.now() });
      analytics.log('coins_earned', { source: 'ad_double', amount: extra, balance: st.save.coins + extra });
    }
    return ok;
  };

  return (
    <View style={{ flex: 1 }}>
      <ResultScreen summary={S} quiz={quiz} coinsBefore={result.coinsBefore} primary={primary} secondary={secondary}
        onDouble={quiz.mode === 'first' ? undefined : onDouble} grid={result.grid} />
    </View>
  );
}
