// Sounds: preloaded once, played instantly. Respects the sound setting.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useGame } from '../store/store';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  pop: require('../../assets/sounds/pop.wav'),
  tick: require('../../assets/sounds/clock_tick.wav'),
  tock: require('../../assets/sounds/clock_tock.wav'),
  correct_0: require('../../assets/sounds/correct_0.wav'),
  correct_1: require('../../assets/sounds/correct_1.wav'),
  correct_2: require('../../assets/sounds/correct_2.wav'),
  correct_3: require('../../assets/sounds/correct_3.wav'),
  correct_4: require('../../assets/sounds/correct_4.wav'),
  correct_5: require('../../assets/sounds/correct_5.wav'),
  correct_6: require('../../assets/sounds/correct_6.wav'),
  correct_7: require('../../assets/sounds/correct_7.wav'),
  wrong: require('../../assets/sounds/wrong.wav'),
  timeout: require('../../assets/sounds/timeout.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  star_1: require('../../assets/sounds/star_1.wav'),
  star_2: require('../../assets/sounds/star_2.wav'),
  star_3: require('../../assets/sounds/star_3.wav'),
  coin_0: require('../../assets/sounds/coin_0.wav'),
  coin_1: require('../../assets/sounds/coin_1.wav'),
  coin_2: require('../../assets/sounds/coin_2.wav'),
  count: require('../../assets/sounds/count.wav'),
  levelup: require('../../assets/sounds/levelup.wav'),
  chest: require('../../assets/sounds/chest.wav'),
  flame: require('../../assets/sounds/flame.wav'),
  card: require('../../assets/sounds/card.wav'),
  unlock: require('../../assets/sounds/unlock.wav'),
  combo_break: require('../../assets/sounds/combo_break.wav'),
  powerup: require('../../assets/sounds/powerup.wav'),
  heart: require('../../assets/sounds/heart.wav'),
  fanfare: require('../../assets/sounds/fanfare.wav'),
} as const;

export type Sfx = keyof typeof SOURCES;

const VOLUME: Partial<Record<Sfx, number>> = { tick: 0.55, tock: 0.55, count: 0.35, whoosh: 0.45, tap: 0.6, pop: 0.5 };
const POOL: Partial<Record<Sfx, number>> = { coin_0: 3, coin_1: 3, coin_2: 3, count: 3, tap: 2, pop: 4, tick: 3, tock: 3, card: 2 };

const players: Partial<Record<Sfx, AudioPlayer[]>> = {};
const cursor: Partial<Record<Sfx, number>> = {};
let loaded = false;

export async function preloadSounds() {
  if (loaded) return;
  loaded = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  } catch {
    /* web or unsupported */
  }
  for (const k of Object.keys(SOURCES) as Sfx[]) {
    const n = POOL[k] ?? 1;
    players[k] = [];
    for (let i = 0; i < n; i++) {
      try {
        const p = createAudioPlayer(SOURCES[k]);
        p.volume = VOLUME[k] ?? 0.8;
        players[k]!.push(p);
      } catch {
        /* a missing sound never breaks the game */
      }
    }
  }
}

export function play(k: Sfx) {
  if (!useGame.getState().save.settings.sound) return;
  const list = players[k];
  if (!list || !list.length) return;
  const i = (cursor[k] ?? 0) % list.length;
  cursor[k] = i + 1;
  const p = list[i];
  try {
    // Each player is rewound right after it plays, so it is already at the start when its turn comes again.
    // Rewinding just before playing is asynchronous and made the clock ticks late or swallowed.
    p.play();
    setTimeout(() => {
      try {
        p.pause();
        void p.seekTo(0);
      } catch {
        /* ignore */
      }
    }, REWIND_AFTER_MS[k] ?? 900);
  } catch {
    /* ignore */
  }
}

/** When a pooled player is rewound after playing (longer than the sound, shorter than its turn coming round again). */
const REWIND_AFTER_MS: Partial<Record<Sfx, number>> = { tick: 230, tock: 230, tap: 120, pop: 120, count: 60, coin_0: 220, coin_1: 220, coin_2: 220, card: 320 };

let music: AudioPlayer | null = null;
/** Light menu music, only when the player turned it on (off by default). */
export function setMenuMusic(on: boolean) {
  const want = on && useGame.getState().save.settings.music;
  try {
    if (want) {
      if (!music) {
        music = createAudioPlayer(require('../../assets/sounds/music.wav'));
        music.loop = true;
        music.volume = 0.35;
      }
      if (!music.playing) music.play();
    } else music?.pause();
  } catch {
    /* ignore */
  }
}

export function playCorrect(combo: number) {
  play(`correct_${Math.max(0, Math.min(7, combo - 1))}` as Sfx);
}

export function playCoin() {
  play(`coin_${Math.floor(Math.random() * 3)}` as Sfx);
}
