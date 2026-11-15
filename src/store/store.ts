// The one game store: the player's save (persisted to MMKV) plus session-only state.
import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { migrate, newSave, SAVE_VERSION, type SaveState } from '../logic/save';
import { dayKey, systemClock, type Clock } from '../logic/time';

const KEY = 'save';
const BACKUP = 'save_backup';

let mmkv: ReturnType<typeof createMMKV> | null = null;
function storage() {
  if (!mmkv) mmkv = createMMKV({ id: 'globeguess' });
  return mmkv;
}

function load(now: number): { save: SaveState; fresh: boolean } {
  try {
    const raw = storage().getString(KEY);
    if (!raw) return { save: newSave(now), fresh: true };
    const parsed = JSON.parse(raw) as { version?: number };
    if ((parsed.version ?? 1) < SAVE_VERSION) storage().set(BACKUP, raw); // keep the old save before migrating
    return { save: migrate(parsed, now), fresh: false };
  } catch {
    // a broken save must never wipe progress silently: try the backup first
    try {
      const b = storage().getString(BACKUP);
      if (b) return { save: migrate(JSON.parse(b), now), fresh: false };
    } catch {
      /* fall through */
    }
    return { save: newSave(now), fresh: true };
  }
}

let writeTimer: ReturnType<typeof setTimeout> | null = null;
function persist(s: SaveState) {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      storage().set(KEY, JSON.stringify(s));
    } catch {
      /* storage full or unavailable: keep playing, try again next change */
    }
  }, 120);
}

export function flushSave() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  try {
    storage().set(KEY, JSON.stringify(useGame.getState().save));
  } catch {
    /* ignore */
  }
}

export type Session = {
  startedAt: number;
  firstSession: boolean;       // the install's first session: no ads, no offers
  rounds: number;
  lastRewardedAt: number;
  shopSeenToday: boolean;
};

type GameStore = {
  save: SaveState;
  session: Session;
  clock: Clock;
  ready: boolean;
  init: () => void;
  update: (fn: (s: SaveState) => SaveState) => void;
  setSession: (p: Partial<Session>) => void;
  setClock: (c: Clock) => void;
  now: () => number;
  today: () => string;
  resetForTests: () => void;
};

export const useGame = create<GameStore>((set, get) => ({
  save: newSave(Date.now()),
  session: { startedAt: Date.now(), firstSession: true, rounds: 0, lastRewardedAt: 0, shopSeenToday: false },
  clock: systemClock,
  ready: false,
  init: () => {
    if (get().ready) return;
    const now = get().clock();
    const { save, fresh } = load(now);
    const s = { ...save, sessions: save.sessions + 1 };
    set({ save: s, ready: true, session: { startedAt: now, firstSession: fresh || s.sessions <= 1, rounds: 0, lastRewardedAt: 0, shopSeenToday: false } });
    persist(s);
  },
  update: (fn) => {
    const next = fn(get().save);
    if (next === get().save) return;
    set({ save: next });
    persist(next);
  },
  setSession: (p) => set({ session: { ...get().session, ...p } }),
  setClock: (c) => set({ clock: c }),
  now: () => get().clock(),
  today: () => dayKey(get().clock()),
  resetForTests: () => {
    const s = newSave(get().clock());
    set({ save: s });
    persist(s);
  },
}));

/** Debug helpers on web (used by the automated play sessions): window.__game */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  (window as unknown as Record<string, unknown>).__game = useGame;
}
