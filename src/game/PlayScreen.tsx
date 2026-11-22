// One round: the video, playable. Camera flies to the target, four answers pop in, the ring counts down with
// tick-tock, the tap is answered instantly (motion + sound + haptic), the reveal teaches the answer.
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, cancelAnimation, runOnJS, useAnimatedReaction, useAnimatedStyle, useDerivedValue, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { balance } from '../config/balance';
import { COSMETICS } from '../config/cosmetics';
import { Press, T, fitSize } from '../components/ui';
import { Icon, ICONS } from '../components/Icon';
import { AnswerButton, AnswerPill, ComboBadge, FlagCard, PowerupButton, ProgressDots, TimerRing, TitleCard, answerTextWidth, type ButtonState } from '../components/round';
import { itemById, itemName, optionLabel } from '../data/gameData';
import { capitalOf } from '../data/capitals';
import { haptic } from '../feedback/haptics';
import { play, playCorrect } from '../feedback/sfx';
import { t, upper } from '../i18n/strings';
import { spendPowerup } from '../logic/economy';
import { comboMultiplier, scoreFor } from '../logic/round';
import type { PowerupId } from '../logic/save';
import type { Answer, Question, QuizDef } from '../logic/types';
import { easeInOut, frameItem, needsWrap, neutralCam, unwrapTowards, widen, zoomAt, zoomLength, type Box, type Cam } from '../map/camera';
import { MapCanvas, type Flight } from '../map/MapCanvas';
import { useMapZoom } from '../map/useMapZoom';
import { GestureDetector } from 'react-native-gesture-handler';
import { warmViews } from '../map/shapes';
import { ads } from '../services/ads';
import { analytics } from '../services/analytics';
import { useGame } from '../store/store';
import { layout, map as M, mapThemes, motion, radius, shadow, sizes, type, type Palette } from '../theme';
import { survivalBatch } from './quizFactory';
import { SecondChanceSheet } from './SecondChanceSheet';
import { PauseSheet } from './PauseSheet';
import { useIsDark, usePalette, useStyles } from '../theme/usePalette';
import { createTicker } from './ticker';

type Phase = 'fly' | 'ask' | 'offer' | 'reveal' | 'done';
const LETTERS = ['A', 'B', 'C', 'D'];

export type RoundResult = { answers: Answer[]; quiz: QuizDef; powerupsUsed: number; durationMs: number };

export function PlayScreen({ quiz: initialQuiz, onDone, onQuit }: { quiz: QuizDef; onDone: (r: RoundResult) => void; onQuit: () => void }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const { width: SW, height: SH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // only the parts of the save this screen shows: a change elsewhere in the save must not re-render the round
  const mapThemeId = useGame((g) => g.save.cosmetics.mapTheme);
  const buttonStyle = useGame((g) => g.save.cosmetics.buttonStyle);
  const powerups = useGame((g) => g.save.powerups);
  const secondChanceTaught = useGame((g) => g.save.taught.secondChance);
  const playerLevel = useGame((g) => g.save.level);
  const update = useGame((g) => g.update);
  const W = Math.min(SW, layout.maxWidth);
  const dark = useIsDark();
  const chosen = COSMETICS.find((c) => c.id === mapThemeId)?.theme ?? 'classic';
  const theme = mapThemes[chosen === 'classic' && dark ? 'night' : chosen] ?? mapThemes.classic;

  // ---- layout (portrait, answers in thumb reach)
  const top = insets.top + 8;
  const titleH = 52;
  const dotsY = top + titleH + 8;
  // power-ups are on screen only once the player has one (or is about to be given one): no empty buttons
  const [showPowerups] = useState(() => {
    if (initialQuiz.mode === 'first') return false;
    const s0 = useGame.getState().save;
    const owned = s0.powerups.fiftyFifty + s0.powerups.freeze + s0.powerups.skip > 0;
    return owned || s0.level >= Math.min(balance.powerupTeachAtLevel.fiftyFifty, balance.powerupTeachAtLevel.freeze, balance.powerupTeachAtLevel.skip);
  });
  const bottomPad = Math.max(insets.bottom, 12);
  const puH = showPowerups ? sizes.big + 18 : 0;
  const gridH = 58 * 2 + 10;
  const gridTop = SH - bottomPad - puH - gridH - 8;
  const mapTop = dotsY + 40;
  const mapBottom = gridTop - 10;
  const box: Box = useMemo(() => ({ fx: SW / 2, fy: (mapTop + mapBottom) / 2, fw: W * 0.86, fh: (mapBottom - mapTop) * 0.92, W: SW }), [SW, W, mapTop, mapBottom]);

  // ---- round state
  const [quiz, setQuiz] = useState(initialQuiz);
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>('fly');
  const [states, setStates] = useState<ButtonState[]>(['idle', 'idle', 'idle', 'idle']);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [combo, setCombo] = useState(0);
  // the countdown number changes every second: it lives in its own little store so only the timer re-renders
  const seconds = useMemo(() => createTicker(initialQuiz.timer), [initialQuiz]);
  const setSecondsLeft = seconds.set;
  const [frozen, setFrozen] = useState(false);
  const [usedFifty, setUsedFifty] = useState(false);
  const [lives, setLives] = useState<number>(balance.survival.lives);
  const [continued, setContinued] = useState(false);
  const [hint, setHint] = useState(quiz.mode === 'first');
  const [scorePop, setScorePop] = useState<{ v: number; k: number } | null>(null);
  const [teach, setTeach] = useState<PowerupId | null>(null);
  const [secondChanceUsedRound, setSecondChanceUsedRound] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const powerupsUsed = useRef(0);
  const startedAt = useRef(Date.now());
  const askStart = useRef(0);
  const timeLeftAtFreeze = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const tickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const survivalUsed = useRef(new Set<string>());

  const q: Question | undefined = quiz.questions[idx];
  const item = q ? itemById(q.itemId) : null;
  const isFlagQ = q?.type === 'flag';
  const isPickFlag = q?.type === 'name_to_flag';
  const canZoom = !!q && !isFlagQ && !isPickFlag;
  const scene = q?.scene ?? 'world';
  const topic = scene === 'usa' ? 'usa' : 'all';

  // ---- map shared values
  const startCam = useMemo(() => widen(neutralCam(initialQuiz.questions[0]?.scene ?? 'world'), M.introZoomFrom), [initialQuiz]);
  const camFrom = useSharedValue<Cam>(startCam);
  const camTo = useSharedValue<Cam>(startCam);
  const camProgress = useSharedValue(1);
  // the game camera; the player's pinch zoom sits on top of it (useMapZoom) and is what the map draws
  const baseCam = useDerivedValue(() => zoomAt(camFrom.value, camTo.value, easeInOut(camProgress.value), M.zoomCurve));
  const zoomOn = useSharedValue(false);
  const { cam, gesture: zoomGesture, reset: resetZoom, toggle: toggleZoom, zoom } = useMapZoom({ base: baseCam, box, H: SH, enabled: zoomOn });
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    zoomOn.value = phase === 'ask' && canZoom;
  }, [phase, canZoom, zoomOn]);
  useAnimatedReaction(() => zoom.value > 1.2, (now, before) => {
    if (now !== before) runOnJS(setZoomed)(now);
  });
  const moving = useDerivedValue(() => (camProgress.value < 1 ? 1 : 0));
  const reveal = useSharedValue(0);
  const targetAlpha = useSharedValue(0);
  const dim = useSharedValue(0);
  const flagSmall = useSharedValue(0);
  const timerP = useSharedValue(1);
  const [wrap, setWrap] = useState(true);
  const [flight, setFlight] = useState<Flight>({ from: startCam, to: startCam });
  const prevScene = useRef(initialQuiz.questions[0]?.scene ?? 'world');

  // parse the map detail around every question of this round in the background, in small slices
  useEffect(() => {
    const views = quiz.questions.map((x) => {
      const it = itemById(x.itemId);
      return it ? { scene: x.scene, cam: frameItem(it, x.scene, box) } : null;
    }).filter((v): v is { scene: typeof quiz.questions[number]['scene']; cam: Cam } => !!v);
    warmViews(views, box, SH);
  }, [quiz, box, SH]);

  const later = (ms: number, f: () => void) => {
    const h = setTimeout(f, ms);
    timers.current.push(h);
  };
  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (tickTimer.current) clearTimeout(tickTimer.current);
    tickTimer.current = null;
  };
  useEffect(() => clearAll, []);


  const flyTo = useCallback((to: Cam, ms: number, onEnd?: () => void) => {
    const from = baseCam.value;
    const target = unwrapTowards(from, to, scene);
    setWrap(scene === 'world' && needsWrap([from, target, { ...target, w: Math.max(from.w, target.w) * 1.6 }], box, SH));
    camFrom.value = from;
    camTo.value = target;
    // map detail is built for what this move shows (see flightPaths)
    setFlight({ from, to: target });
    camProgress.value = 0;
    camProgress.value = withTiming(1, { duration: ms, easing: Easing.linear }, (fin) => {
      if (fin && onEnd) runOnJS(onEnd)();
    });
  }, [baseCam, camFrom, camTo, camProgress, scene, box, SH]);

  // ---- question start
  useEffect(() => {
    if (!q || !item) return;
    clearAll();
    zoomOn.value = false;
    resetZoom();
    setPhase('fly');
    setStates(['idle', 'idle', 'idle', 'idle']);
    setFrozen(false);
    frozenRef.current = false;
    setUsedFifty(false);
    setSecondsLeft(quiz.timer);
    timerP.value = 1;
    reveal.value = 0;
    flagSmall.value = 0;
    if (prevScene.current !== scene) {
      // different map (world <-> USA): start from a wide view of the new map instead of flying across projections
      const w = widen(neutralCam(scene), 1.4);
      camFrom.value = w;
      camTo.value = w;
      camProgress.value = 1;
      prevScene.current = scene;
    }
    const prevCam = baseCam.value;
    let to: Cam;
    if (isFlagQ || isPickFlag) {
      to = neutralCam('world');
      targetAlpha.value = withTiming(0, { duration: 150 });
      dim.value = withTiming(isFlagQ ? 1 : 0.6, { duration: 250 });
    } else {
      to = frameItem(item, scene, box);
      targetAlpha.value = 0;
      dim.value = withTiming(0, { duration: 200 });
    }
    const len = zoomLength(prevCam, to);
    const ms = idx === 0 ? motion.camIntro : Math.max(motion.camMin, Math.min(motion.camMax, 380 + len * 260));
    if (len > 0.05) play('whoosh');
    flyTo(to, ms, () => {
      if (!isFlagQ && !isPickFlag) targetAlpha.value = withTiming(1, { duration: 260 });
      startAsk();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, quiz]);

  // ---- teaching moments: a power-up offered free at a moment it helps
  const teachFor = (qq: Question): PowerupId | null => {
    if (quiz.mode === 'first' || quiz.mode === 'daily') return null;
    const lv = useGame.getState().save.level;
    const taught = useGame.getState().save.taught;
    const hardish = qq.tier === 'medium' || qq.tier === 'hard' || qq.tier === 'very_hard';
    const T = balance.powerupTeachAtLevel;
    if (!taught.fiftyFifty && lv >= T.fiftyFifty && hardish) return 'fiftyFifty';
    if (!taught.freeze && lv >= T.freeze && hardish) return 'freeze';
    if (!taught.skip && lv >= T.skip && hardish && quiz.mode !== 'survival') return 'skip';
    return null;
  };

  const startAsk = () => {
    setPhase('ask');
    if (q) setTeach(teachFor(q));
    for (let i = 0; i < 4; i++) later(i * 60, () => play('pop'));
    askStart.current = Date.now();
    runTimer(quiz.timer * 1000);
    if (idx === 0) analytics.log(quiz.mode === 'first' ? 'tutorial_round_start' : 'round_start', { mode: quiz.mode, level: quiz.levelId ?? null });
  };

  const runTimer = (ms: number) => {
    const total = quiz.timer * 1000;
    timerP.value = ms / total;
    timerP.value = withTiming(0, { duration: ms, easing: Easing.linear });
    const end = Date.now() + ms;
    timerEnd.current = end;
    // The clock is scheduled on its own beats, not polled: a tick exactly when the number changes (10, 9, 8 ...),
    // and in the last seconds a tock half-way between. Each timeout aims at the next beat from the true end time,
    // so a late timer never pushes the following beats back.
    if (tickTimer.current) clearTimeout(tickTimer.current);
    const fastAt = balance.round.tickTockFastAt * 1000;
    const beat = () => {
      const left = end - Date.now();
      if (left <= 30) {
        tickTimer.current = null;
        setSecondsLeft(0);
        answer(null);
        return;
      }
      const sec = Math.ceil(left / 1000);
      setSecondsLeft(sec);
      // sound only on a beat (after a pause or freeze the first call can fall between beats)
      if (Math.abs(left - Math.round(left / 1000) * 1000) < 120) play('tick');
      else if (left <= fastAt + 120 && Math.abs(left - Math.round(left / 500) * 500) < 120) play('tock');
      const step = left - 20 <= fastAt ? 500 : 1000;
      const next = Math.floor((left - 20) / step) * step; // the time left at the next beat
      tickTimer.current = setTimeout(beat, Math.max(16, end - next - Date.now()));
    };
    beat();
  };

  const [paused, setPaused] = useState(false);
  const timerEnd = useRef(0);
  const pausedLeft = useRef(0);
  const pause = () => {
    if (phaseRef.current !== 'ask') {
      setPaused(true);
      return;
    }
    pausedLeft.current = Math.max(500, timerEnd.current - Date.now());
    if (!frozenRef.current) stopTimer();
    setPaused(true);
  };
  const resume = () => {
    setPaused(false);
    if (phaseRef.current === 'ask' && !frozenRef.current && pausedLeft.current > 0) {
      askStart.current = Date.now() - (quiz.timer * 1000 - pausedLeft.current);
      runTimer(pausedLeft.current);
    }
    pausedLeft.current = 0;
  };

  const stopTimer = () => {
    if (tickTimer.current) clearTimeout(tickTimer.current);
    tickTimer.current = null;
    cancelAnimation(timerP);
  };

  const timeLeftFrac = () => Math.max(0, 1 - (Date.now() - askStart.current) / (quiz.timer * 1000));

  // ---- answering
  const answer = (k: number | null, opts: { skipped?: boolean } = {}) => {
    if (!q || !item) return;
    if (phaseRef.current !== 'ask' || answeredRef.current === idx) return;
    answeredRef.current = idx;
    stopTimer();
    setHint(false);
    setTeach(null);
    const right = k === q.answer || !!opts.skipped;
    const ms = Date.now() - askStart.current;
    if (!right && k !== null && canOfferSecondChance()) {
      // wrong, but a second chance is possible: shake, then offer it with the clock stopped
      setStates((s) => s.map((x, i) => (i === k ? 'wrong' : x)) as ButtonState[]);
      play('wrong');
      haptic.error();
      timeLeftAtFreeze.current = Math.max(1000, (1 - ms / (quiz.timer * 1000)) * quiz.timer * 1000);
      setPhase('offer');
      phaseRef.current = 'offer';
      return;
    }
    finishQuestion(k, right, ms, opts.skipped);
  };

  const finishQuestion = (k: number | null, right: boolean, ms: number, skipped?: boolean) => {
    if (!q || !item) return;
    const newCombo = right ? combo + 1 : 0;
    const sc = skipped ? 0 : scoreFor(right, timeLeftFrac(), newCombo);
    setStates((s) => s.map((x, i) => (i === q.answer ? 'correct' : i === k ? 'wrong' : x === 'removed' ? 'removed' : 'faded')) as ButtonState[]);
    if (right) {
      playCorrect(newCombo);
      haptic.success();
      setScorePop({ v: sc, k: idx });
    } else {
      play(k === null ? 'timeout' : 'wrong');
      haptic.error();
      if (combo >= 2) later(180, () => play('combo_break'));
    }
    setCombo(newCombo);
    const a: Answer = { itemId: q.itemId, type: q.type, scene: q.scene, tier: q.tier, correct: right, chosen: k, timeMs: ms, score: sc, combo: newCombo, skipped };
    setAnswers((prev) => [...prev, a]);
    analytics.log('question_answered', { mode: quiz.mode, type: q.type, item_id: q.itemId, tier: q.tier, correct: right, time_ms: ms, chosen_id: k === null ? null : q.options[k] });
    setDone((d) => [...d, q.itemId]);
    // reveal on the map: the right area turns green (on a miss too: a miss always teaches the answer)
    reveal.value = withTiming(1, { duration: 250 });
    if (isFlagQ || isPickFlag) {
      flagSmall.value = withSpring(1, motion.springSoft);
      dim.value = withTiming(0, { duration: 300 });
      targetAlpha.value = withTiming(1, { duration: 300 });
      flyTo(frameItem(item, scene, box, M.flagTargetFill, M.minKm.flag), 650);
    }
    setPhase('reveal');
    phaseRef.current = 'reveal';
    revealOf.current = { idx, at: Date.now(), right };
    let livesLeft = lives;
    if (quiz.mode === 'survival' && !right) {
      livesLeft = lives - 1;
      setLives(livesLeft);
      later(250, () => play('heart'));
    }
    const dbgHold = (globalThis as unknown as { __mapDebug?: { holdMs?: number } }).__mapDebug?.holdMs;
    const hold = dbgHold ?? (right ? motion.revealHold : motion.wrongHold);
    later(hold, () => next(livesLeft));
  };

  const phaseRef = useRef<Phase>('fly');
  const answeredRef = useRef(-1);
  const frozenRef = useRef(false);
  const revealOf = useRef<{ idx: number; at: number; right: boolean } | null>(null);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const canOfferSecondChance = () => {
    // not in the Daily Challenge (same for everyone), the first round, or Survival (lives already forgive misses)
    if (quiz.mode === 'daily' || quiz.mode === 'first' || quiz.mode === 'survival') return false;
    const s = useGame.getState().save;
    const free = !s.taught.secondChance && s.level >= balance.powerupTeachAtLevel.secondChance;
    const adOk = secondChanceUsedRound < balance.ads.rewardedSecondChancePerRound && ads.rewardedReady() && !useGame.getState().session.firstSession;
    return free || s.powerups.secondChance > 0 || adOk;
  };

  const onSecondChance = (how: 'item' | 'free' | 'ad' | 'no') => {
    if (!q) return;
    if (how === 'no') {
      const k = states.findIndex((x) => x === 'wrong');
      setPhase('ask');
      phaseRef.current = 'ask';
      finishQuestion(k, false, Date.now() - askStart.current);
      return;
    }
    const go = () => {
      powerupsUsed.current += 1;
      setSecondChanceUsedRound((n) => n + 1);
      setStates((s) => s.map((x) => (x === 'wrong' ? 'removed' : x)) as ButtonState[]);
      answeredRef.current = -1;
      setPhase('ask');
      phaseRef.current = 'ask';
      play('powerup');
      if (!frozenRef.current) runTimer(timeLeftAtFreeze.current);
    };
    if (how === 'free') {
      update((s) => ({ ...s, taught: { ...s.taught, secondChance: true } }));
      go();
    } else if (how === 'item') {
      update((s) => spendPowerup(s, 'secondChance') ?? s);
      go();
    } else {
      ads.rewarded('second_chance').then((ok) => (ok ? go() : onSecondChance('no')));
    }
  };

  const next = (livesLeft: number) => {
    revealOf.current = null;
    setScorePop(null);
    if (quiz.mode === 'survival') {
      if (livesLeft <= 0) {
        if (!continued && ads.rewardedReady() && !useGame.getState().session.firstSession) {
          setPhase('offer');
          phaseRef.current = 'offer';
          return;
        }
        return end();
      }
      if (idx + 2 >= quiz.questions.length) {
        const right = answersRef.current.filter((a) => a.correct).length;
        setQuiz((qz) => ({ ...qz, questions: [...qz.questions, ...survivalBatch(right, survivalUsed.current)] }));
      }
      setIdx((i) => i + 1);
      return;
    }
    if (idx + 1 >= quiz.questions.length) return end();
    setIdx((i) => i + 1);
  };

  const answersRef = useRef<Answer[]>([]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const end = () => {
    setPhase('done');
    phaseRef.current = 'done';
    clearAll();
    later(250, () => onDone({ answers: answersRef.current, quiz, powerupsUsed: powerupsUsed.current, durationMs: Date.now() - startedAt.current }));
  };

  const skipWait = () => {
    // tap to skip the wait, but only once the answer has been on screen long enough to be read
    const r = revealOf.current;
    if (phaseRef.current !== 'reveal' || !r || r.idx !== idx) return;
    if (Date.now() - r.at < (r.right ? 350 : 750)) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const livesLeft = lives;
    next(livesLeft);
  };

  // ---- power-ups
  const usePU = (id: PowerupId) => {
    if (phaseRef.current !== 'ask' || !q) return;
    const s = useGame.getState().save;
    const free = teach === id;
    if (id === 'fiftyFifty' && usedFifty) return;
    if (!free && s.powerups[id] <= 0) return;
    powerupsUsed.current += 1;
    update((st) => {
      const after = free ? st : spendPowerup(st, id) ?? st;
      return free ? { ...after, taught: { ...after.taught, [id]: true } } : after;
    });
    setTeach(null);
    if (id === 'fiftyFifty') {
      setUsedFifty(true);
      const wrongs = [0, 1, 2, 3].filter((i) => i !== q.answer && states[i] !== 'removed');
      const drop = wrongs.sort(() => Math.random() - 0.5).slice(0, 2);
      setStates((st) => st.map((x, i) => (drop.includes(i) ? 'removed' : x)) as ButtonState[]);
    } else if (id === 'freeze') {
      stopTimer();
      frozenRef.current = true;
      setFrozen(true);
    } else if (id === 'skip') {
      answer(q.answer, { skipped: true });
    }
  };

  // ---- survival continue
  const onContinue = (yes: boolean) => {
    if (!yes) return end();
    ads.rewarded('survival_continue').then((ok) => {
      if (!ok) return end();
      setContinued(true);
      setLives(1);
      setPhase('reveal');
      phaseRef.current = 'reveal';
      setIdx((i) => i + 1);
    });
  };

  const doneHere = useMemo(() => done.filter((d) => (scene === 'usa') === d.startsWith('US-')), [done, scene]);

  // one text size for all four answers: a long name shrinks every answer, so the four always look the same
  const btnW = (W - 24 - 84) / 2;
  const answerFonts = useMemo(() => {
    if (!q || isPickFlag) return [0, 1, 2, 3].map(() => ({ size: type.body, lines: 1 }));
    const tw = answerTextWidth(btnW);
    const names = q.options.map((o) => upper(optionLabel(o, q.type)));
    // Poppins Bold capitals are about 0.78 em wide (0.7 was too hopeful: KYRGYZSTAN broke mid-word)
    const fits = names.map((n) => fitSize(n, type.body, tw, 12, 0.78));
    // one size for all four (never below 12); names with spaces may wrap to two lines at that size
    const common = Math.max(12, Math.min(...fits.map((f) => f.size)));
    const lines = Math.min(2, Math.max(...fits.map((f) => f.lines)));
    // a single word is always one line: it can never break mid-word, and if it is still too wide the text
    // shrinks itself to fit (adjustsFontSizeToFit), without touching the other three
    return names.map((n) => {
      if (n.includes(' ')) return { size: common, lines };
      const own = Math.floor(tw / (n.length * 0.78));
      return { size: Math.max(9, Math.min(common, own)), lines: 1 };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.itemId, idx, btnW]);

  // automated play sessions (web only) read the current question here
  if (typeof document !== 'undefined') (globalThis as unknown as Record<string, unknown>).__round = { idx, phase, answer: q?.answer, mode: quiz.mode, n: quiz.questions.length, states };

  // ---- render
  const results = quiz.mode === 'survival' ? [] : quiz.questions.map((_, i) => (answers[i] ? answers[i].correct : null));
  const title = q?.type === 'capital' ? t('q_capital', { name: upper(itemName(q.itemId)) })
    : scene === 'usa' ? t('q_state') : isFlagQ ? t('q_flag') : isPickFlag ? t('q_pick_flag') : t('q_country');
  const tierChip = quiz.mode === 'daily' ? 'mixed' : quiz.mode === 'survival' ? q?.tier : quiz.tierLabel === 'boss' ? undefined : quiz.tierLabel;
  const offerSecond = phase === 'offer' && quiz.mode !== 'survival';
  const offerContinue = phase === 'offer' && quiz.mode === 'survival' && lives <= 0;

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapCanvas width={SW} height={SH} box={box} scene={scene} topic={topic} cam={cam} targetId={q?.itemId ?? null} reveal={reveal}
        targetAlpha={targetAlpha} dim={dim} done={doneHere} wrap={wrap} theme={theme} flight={flight} moving={moving} />
      <Pressable style={StyleSheet.absoluteFill} onPress={skipWait} testID="skip-area" />
      {/* pinch / drag / double-tap zoom while a map question is open */}
      {phase === 'ask' && canZoom ? (
        <GestureDetector gesture={zoomGesture}>
          <View style={StyleSheet.absoluteFill} testID="zoom-area" />
        </GestureDetector>
      ) : null}

      {/* header */}
      <View style={[st.col, { top, width: W, left: (SW - W) / 2 }]} pointerEvents="box-none">
        <TitleCard title={title} />
        <View style={{ height: 8 }} />
        {quiz.mode === 'survival' ? (
          <View style={st.lives}>
            {Array.from({ length: balance.survival.lives }, (_, i) => (
              <Icon key={i} name={i < lives ? 'heart' : 'heart-outline'} size={24} color={colors.heart} />
            ))}
            <View style={[st.survivalCount, shadow.soft]}><Icon name="check-bold" size={16} color={colors.correct} /><T size={type.label} weight="black">{String(answers.filter((a) => a.correct).length)}</T></View>
          </View>
        ) : (
          <ProgressDots total={quiz.questions.length} index={idx} results={results} tier={quiz.tierLabel === 'boss' ? 'boss' : tierChip} />
        )}
      </View>
      <Press onPress={pause} style={[st.close, { top: top + 6, right: (SW - W) / 2 + 20 }]} testID="pause" hitSlop={10}>
        <View style={st.closeInner}><Icon name="pause" size={22} color={colors.inkSoft} /></View>
      </Press>

      {/* flag card */}
      {(isFlagQ) && q ? (
        <View style={[st.flagWrap, { top: (mapTop + mapBottom) / 2 - (W * 0.62 * 0.8) / 2 }]} pointerEvents="none">
          <FlagCard flagId={q.itemId} small={flagSmall} width={W * 0.62} />
        </View>
      ) : null}
      {isPickFlag && q ? (
        <View style={[st.flagWrap, { top: (mapTop + mapBottom) / 2 - 40 }]} pointerEvents="none">
          <View style={[st.namePrompt, shadow.card]}><T size={type.title} weight="black" center>{upper(itemName(q.itemId))}</T></View>
        </View>
      ) : null}

      {/* answer pill + combo + score pop */}
      <View style={[st.pillWrap, { top: mapTop + 4 }]} pointerEvents="none">
        <AnswerPill name={q ? (q.type === 'capital' ? `${capitalOf(q.itemId) ?? ''} · ${itemName(q.itemId)}` : itemName(q.itemId)) : ''} correct={answers[idx]?.correct ?? true} visible={phase === 'reveal' && !!answers[idx]} flagId={q && q.scene === 'world' && (q.type === 'map' || q.type === 'capital') ? q.itemId : undefined} />
      </View>
      <View style={[st.comboWrap, { top: mapTop + 56, right: (SW - W) / 2 + 52 }]} pointerEvents="none">
        <ComboBadge combo={combo} />
      </View>
      {scorePop ? <ScorePop key={scorePop.k} value={scorePop.v} combo={combo} y={gridTop - 40} /> : null}
      {hint && phase === 'ask' ? (
        <View style={[st.hint, { top: gridTop - 44 }]} pointerEvents="none"><T size={type.body} weight="bold" color={colors.ink}>{t('hint_first')}</T></View>
      ) : null}

      {/* answers 2x2 with the timer between them, like the videos */}
      {q ? (
        <View style={[st.grid, { top: gridTop, left: (SW - W) / 2 + 12, width: W - 24 }]}>
          {[0, 1].map((row) => (
            <View key={row} style={st.row}>
              {[0, 1].map((col) => {
                const i = row * 2 + col;
                return (
                  <View key={col} style={{ width: btnW }}>
                    <AnswerButton letter={LETTERS[i]} label={optionLabel(q.options[i], q.type)} flagId={isPickFlag ? q.options[i] : undefined}
                      state={states[i]} index={i} revealKey={phase === 'fly' ? `${idx}-fly` : `${idx}`} disabled={phase !== 'ask'} skin={buttonStyle}
                      onPress={() => answer(i)} testID={`answer-${i}`} width={btnW} fontSize={answerFonts[i].size} lines={answerFonts[i].lines} />
                  </View>
                );
              }).reduce<React.ReactNode[]>((acc, el, j) => (j === 1 ? [...acc, <View key="gap" style={{ width: 84 }} />, el] : [...acc, el]), [])}
            </View>
          ))}
          <View style={[st.timer, { left: (W - 24) / 2 - 38 }]} pointerEvents="none">
            {!(globalThis as unknown as { __mapDebug?: Record<string, boolean> }).__mapDebug?.noTimer ? <TimerRing progress={timerP} seconds={seconds} frozen={frozen} /> : null}
          </View>
        </View>
      ) : null}

      {/* magnifier: zoom on the target with one thumb (pinch and double-tap work too) */}
      {canZoom && (phase === 'ask' || zoomed) ? (
        <Press onPress={() => toggleZoom()} style={[st.zoomBtn, { top: gridTop - 58, right: (SW - W) / 2 + 14 }]} testID="zoom" scaleTo={0.88}>
          <View style={[st.zoomInner, zoomed && { backgroundColor: colors.accent }]}>
            <Icon name={zoomed ? 'magnify-minus' : 'magnify-plus'} size={26} color={zoomed ? colors.white : colors.accent} />
          </View>
        </Press>
      ) : null}

      {/* power-ups */}
      {showPowerups && q ? (
        <View style={[st.puBar, { bottom: bottomPad, left: (SW - W) / 2, width: W }]}>
          {(['fiftyFifty', 'freeze', 'skip'] as PowerupId[]).map((id) => {
            const notHere = id === 'skip' && (quiz.mode === 'daily' || quiz.mode === 'survival');
            if (notHere) return null;
            if (powerups[id] <= 0 && teach !== id) return null;
            return (
              <PowerupButton key={id} icon={ICONS[id]} label={t(`pu_${id}` as never)}
                count={powerups[id]} free={teach === id} highlight={teach === id}
                disabled={phase !== 'ask' || (id === 'fiftyFifty' && usedFifty) || (id === 'freeze' && frozen)}
                onPress={() => usePU(id)} testID={`pu-${id}`} />
            );
          })}
        </View>
      ) : null}
      {teach && phase === 'ask' ? (
        <View style={[st.teach, { top: gridTop - 40 }]} pointerEvents="none">
          <View style={[st.teachBubble, shadow.card]}><T size={type.label} weight="bold" color={colors.white}>{t(`pu_teach_${teach}` as never)}</T></View>
        </View>
      ) : null}

      {offerSecond ? (
        <SecondChanceSheet onPick={onSecondChance} items={powerups.secondChance} free={!secondChanceTaught && playerLevel >= balance.powerupTeachAtLevel.secondChance}
          adOk={secondChanceUsedRound < balance.ads.rewardedSecondChancePerRound && ads.rewardedReady() && !useGame.getState().session.firstSession} />
      ) : null}
      {paused ? <PauseSheet onResume={resume} onQuit={quiz.mode === 'first' ? undefined : onQuit} /> : null}
      {offerContinue ? <SecondChanceSheet survival onPick={(h) => onContinue(h === 'ad')} items={0} free={false} adOk /> : null}
    </View>
  );
}

function ScorePop({ value, combo, y }: { value: number; combo: number; y: number }) {
  const colors = usePalette();
  const st = useStyles(make_st);
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withSequence(withSpring(1, motion.spring), withTiming(1, { duration: 500 }), withTiming(2, { duration: 300 }));
  }, [v]);
  const a = useAnimatedStyle(() => ({
    opacity: v.value <= 1 ? v.value : 2 - v.value,
    transform: [{ translateY: -30 * Math.min(1, v.value) - 20 * Math.max(0, v.value - 1) }, { scale: 0.6 + 0.4 * Math.min(1, v.value) }],
  }));
  return (
    <Animated.View style={[st.scorePop, { top: y }, a]} pointerEvents="none">
      <T size={combo >= 3 ? type.display : type.title + 4} weight="black" color={combo >= 5 ? colors.flame : colors.correct} style={st.scoreShadow}>{`+${value}`}</T>
      {combo >= 2 ? <T size={type.label} weight="black" color={colors.ink}>{`x${comboMultiplier(combo)}`}</T> : null}
    </Animated.View>
  );
}

const make_st = (colors: Palette) => StyleSheet.create({
  col: { position: 'absolute', paddingHorizontal: 12 },
  lives: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2 },
  survivalCount: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 10, height: 28 },
  close: { position: 'absolute', zIndex: 5 },
  zoomBtn: { position: 'absolute', zIndex: 4 },
  zoomInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 3, borderBottomColor: 'rgba(15,23,42,0.16)' },
  closeInner: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  flagWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  namePrompt: { backgroundColor: colors.surface, borderRadius: radius.xl, paddingHorizontal: 22, paddingVertical: 14, maxWidth: '86%' },
  pillWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  comboWrap: { position: 'absolute', width: 90, height: 70, alignItems: 'center', justifyContent: 'center' },
  grid: { position: 'absolute', gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  timer: { position: 'absolute', top: 58 + 5 - 38 },
  puBar: { position: 'absolute', flexDirection: 'row', justifyContent: 'center', gap: 18, paddingTop: 6 },
  teach: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  teachBubble: { backgroundColor: colors.correct, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 6 },
  hint: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  scorePop: { position: 'absolute', alignSelf: 'center', alignItems: 'center' },
  scoreShadow: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
});
