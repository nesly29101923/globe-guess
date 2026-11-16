// The look of the videos (../guessyourflag/themes/default.toml), in one place.
// Components take every colour, font, radius, shadow and timing from here.

export const colors = {
  bg: '#C9E2F6',          // screen background behind cards
  surface: '#FFFFFF',     // cards, sheets, pills
  ink: '#0F172A',
  inkSoft: '#64748B',
  chip: '#EEF2F7',
  white: '#FFFFFF',
  accent: '#7C3AED',
  accentDark: '#4C1D95',
  accentSoft: '#EDE9FE',
  correct: '#16A34A',
  correctDark: '#14532D',
  correctSoft: '#BBF7D0',
  wrong: '#DC2626',
  wrongSoft: '#FEE2E2',
  gold: '#F59E0B',
  goldDark: '#B45309',
  goldSoft: '#FEF3C7',
  flame: '#F97316',
  track: '#E2E8F0',
  timer: ['#22C55E', '#F59E0B', '#EF4444'] as const,
  dim: 'rgba(15,23,42,0.55)',
  progressTodo: 'rgba(255,255,255,0.78)',
  progressTodoEdge: '#94A3B8',
  disabled: '#CBD5E1',
  heart: '#EF4444',
};

export type Palette = typeof colors;

/** Dark mode: same accents, dark surfaces and light text. */
export const darkColors: Palette = {
  ...colors,
  bg: '#0B1530',
  surface: '#1C2742',
  ink: '#F1F5F9',
  inkSoft: '#94A3B8',
  chip: '#2B3756',
  accentSoft: '#2E2459',
  correctSoft: '#14532D',
  wrongSoft: '#4C1D1D',
  goldSoft: '#3D3015',
  track: '#2B3756',
  progressTodo: 'rgba(255,255,255,0.25)',
  progressTodoEdge: '#64748B',
  disabled: '#475569',
};

export const tierColors: Record<string, string> = {
  very_easy: '#16A34A',
  easy: '#0EA5E9',
  medium: '#F59E0B',
  hard: '#F97316',
  very_hard: '#DC2626',
  mixed: '#7C3AED',
};

/** Map colour sets. "classic" is the videos; the others are cosmetics (see config/cosmetics). */
export type MapTheme = {
  id: string;
  seaTop: string;
  seaBottom: string;
  graticule: string;
  land: string;
  landEdge: string;
  other: string;
  otherEdge: string;
  shadow: string;
  done: string;
  target: string;
  targetEdge: string;
  correct: string;
  correctEdge: string;
  dark: boolean;
};

export const mapThemes: Record<string, MapTheme> = {
  classic: {
    id: 'classic', seaTop: '#CFE6F7', seaBottom: '#B4D6F2', graticule: 'rgba(255,255,255,0.27)',
    land: '#FFFDF9', landEdge: '#8C9DB0', other: '#E6EBF0', otherEdge: '#B8C4D0', shadow: '#9CC3E4',
    done: '#BBF7D0', target: '#7C3AED', targetEdge: '#4C1D95', correct: '#16A34A', correctEdge: '#14532D',
    dark: false,
  },
  night: {
    id: 'night', seaTop: '#0B1530', seaBottom: '#111F45', graticule: 'rgba(255,255,255,0.08)',
    land: '#1E2A4A', landEdge: '#5B6B94', other: '#151E38', otherEdge: '#2C3860', shadow: '#060B1A',
    done: '#14532D', target: '#F59E0B', targetEdge: '#FDE68A', correct: '#22C55E', correctEdge: '#BBF7D0',
    dark: true,
  },
  sunset: {
    id: 'sunset', seaTop: '#FDE2CF', seaBottom: '#F9C6B0', graticule: 'rgba(255,255,255,0.3)',
    land: '#FFFBF5', landEdge: '#B7867A', other: '#F3E3DA', otherEdge: '#D8B9AB', shadow: '#EBA98F',
    done: '#BBF7D0', target: '#DB2777', targetEdge: '#831843', correct: '#16A34A', correctEdge: '#14532D',
    dark: false,
  },
  mint: {
    id: 'mint', seaTop: '#D5F5EC', seaBottom: '#B5EADB', graticule: 'rgba(255,255,255,0.3)',
    land: '#FFFFFB', landEdge: '#7FA197', other: '#E3EFEA', otherEdge: '#B5CCC3', shadow: '#93D6C2',
    done: '#FDE68A', target: '#0EA5E9', targetEdge: '#075985', correct: '#16A34A', correctEdge: '#14532D',
    dark: false,
  },
  parchment: {
    id: 'parchment', seaTop: '#EDE3CC', seaBottom: '#DCCDAA', graticule: 'rgba(120,90,40,0.18)',
    land: '#FBF6EA', landEdge: '#8B7355', other: '#E9DFC8', otherEdge: '#BBA67F', shadow: '#C8B48A',
    done: '#C7E6B5', target: '#B91C1C', targetEdge: '#7F1D1D', correct: '#15803D', correctEdge: '#14532D',
    dark: false,
  },
  arctic: {
    id: 'arctic', seaTop: '#E0F2FE', seaBottom: '#BAE6FD', graticule: 'rgba(255,255,255,0.4)',
    land: '#FFFFFF', landEdge: '#7DA3C0', other: '#EAF2F8', otherEdge: '#B9CCDB', shadow: '#93C5FD',
    done: '#A7F3D0', target: '#2563EB', targetEdge: '#1E3A8A', correct: '#16A34A', correctEdge: '#14532D',
    dark: false,
  },
  royal: {
    id: 'royal', seaTop: '#312E81', seaBottom: '#1E1B4B', graticule: 'rgba(253,230,138,0.12)',
    land: '#EDE9FE', landEdge: '#A78BFA', other: '#3B3779', otherEdge: '#4C4799', shadow: '#0F0C3A',
    done: '#FDE68A', target: '#F59E0B', targetEdge: '#78350F', correct: '#22C55E', correctEdge: '#14532D',
    dark: true,
  },
  neon: {
    id: 'neon', seaTop: '#0A0A1A', seaBottom: '#1A0B2E', graticule: 'rgba(236,72,153,0.18)',
    land: '#1F1638', landEdge: '#A855F7', other: '#140F26', otherEdge: '#4C1D95', shadow: '#000000',
    done: '#065F46', target: '#22D3EE', targetEdge: '#CFFAFE', correct: '#4ADE80', correctEdge: '#DCFCE7',
    dark: true,
  },
};

export const fonts = {
  black: 'Poppins-Black',
  xbold: 'Poppins-ExtraBold',
  bold: 'Poppins-Bold',
  semi: 'Poppins-SemiBold',
};

export const fontFiles = {
  'Poppins-Black': require('../../assets/fonts/Poppins-Black.ttf'),
  'Poppins-ExtraBold': require('../../assets/fonts/Poppins-ExtraBold.ttf'),
  'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
};

/** Design sizes are for a 390-wide phone (the studio's 1080 canvas / 2.77). */
export const radius = { sm: 12, md: 16, lg: 22, xl: 28, pill: 999 };

/** The type scale. Every text uses one of these sizes, so the same role always has the same size. */
export const type = {
  hero: 56,     // the big score number
  display: 32,  // result headline, celebration title
  title: 22,    // screen titles, sheet titles, question title
  heading: 17,  // card titles, primary labels
  body: 15,     // answers, rows, buttons
  label: 13,    // secondary labels, chips text, counters
  caption: 11,  // small captions under icons
};

/** Shared control sizes: everything in one row has the same height. */
export const sizes = {
  hud: 44,      // top bar pills and icon buttons
  touch: 48,    // smallest tappable
  rail: 58,     // home side buttons
  dock: 62,     // bottom dock buttons
  big: 62,      // primary button height
  small: 48,    // secondary button height
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
};

export const motion = {
  pressScale: 0.93,
  spring: { damping: 12, stiffness: 260, mass: 0.7 },
  springSoft: { damping: 14, stiffness: 160, mass: 0.8 },
  enter: 240,          // ms, things arrive
  exit: 160,           // ms, things leave faster than they arrive
  camMin: 650,         // ms, camera move between targets
  camMax: 1150,
  camIntro: 700,
  revealHold: 1100,    // ms before the next question starts (tap skips)
  wrongHold: 1700,     // a miss holds longer so the answer is learnt
  blinkHz: 3,
  blinkMs: 1000,
  wrongAlpha: 0.35,
  beat: 480,           // ms per result-screen beat
  countUp: 650,
  breathe: 1400,       // idle pulse period
};

export const map = {
  targetFill: 0.4,
  flagTargetFill: 0.3,
  zoomCurve: 1.3,
  introZoomFrom: 2.2,
  maxWorldShare: 0.62,
  minKm: { country: 650, state: 550, flag: 650 },
  tinyKm2: 2500,
  tinyFactor: 2.5,
  tinyPx: 14,
  ringRadius: 18,
  edge: 0.8,
  targetEdge: 1.4,
  shadowOffset: 3,
  glowBlur: 7,
};

export const layout = {
  maxWidth: 520,       // tablets: the game column is centred
  minTouch: 48,
};
