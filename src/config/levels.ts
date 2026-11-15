// Level definitions: topics, the Journey chapters and their levels, Quick Play and Daily Challenge recipes.
import type { Tier } from '../logic/types';

export type Topic = 'world' | 'europe' | 'asia' | 'africa' | 'americas' | 'oceania' | 'usa';
export type QType = 'map' | 'flag' | 'name_to_flag';

/** Tier weights for a level, in order very_easy..very_hard. */
export type TierMix = [number, number, number, number, number];

export const TIER_MIX: Record<string, TierMix> = {
  ve: [1, 0, 0, 0, 0],
  ve_e: [0.6, 0.4, 0, 0, 0],
  e: [0.2, 0.8, 0, 0, 0],
  e_m: [0, 0.5, 0.5, 0, 0],
  m: [0, 0.2, 0.8, 0, 0],
  m_h: [0, 0, 0.5, 0.5, 0],
  h: [0, 0, 0.2, 0.8, 0],
  h_vh: [0, 0, 0, 0.5, 0.5],
  vh: [0, 0, 0, 0.3, 0.7],
  mixed: [0.22, 0.24, 0.22, 0.18, 0.14],
  boss_easy: [0.3, 0.4, 0.3, 0, 0],
  boss_mid: [0, 0.3, 0.4, 0.3, 0],
  boss_hard: [0, 0, 0.3, 0.4, 0.3],
};

export type ChapterDef = {
  id: string;
  topic: Topic;
  /** question types used, with share (name_to_flag only appears as variety in later chapters) */
  types: Partial<Record<QType, number>>;
  /** tier mix per level; the last entry is the boss */
  ramp: string[];
  starsToOpen: number;   // total Journey stars needed to open the chapter (plus the previous boss cleared)
  icon: string;          // emoji used on the path
};

const RAMP_EASY = ['ve', 've', 've', 've_e', 've_e', 'e', 'e', 'e_m', 'e_m', 'boss_easy'];
const RAMP_MID = ['ve_e', 'e', 'e', 'e_m', 'e_m', 'm', 'm', 'm_h', 'm_h', 'boss_mid'];
const RAMP_HARD = ['e_m', 'm', 'm', 'm_h', 'm_h', 'h', 'h', 'h_vh', 'h_vh', 'boss_hard'];
const RAMP_EXPERT = ['m_h', 'h', 'h', 'h_vh', 'h_vh', 'vh', 'vh', 'vh', 'vh', 'boss_hard'];

export const CHAPTERS: ChapterDef[] = [
  { id: 'world_famous', topic: 'world', types: { map: 1 }, ramp: RAMP_EASY, starsToOpen: 0, icon: '🌍' },
  { id: 'usa_1', topic: 'usa', types: { map: 1 }, ramp: RAMP_EASY, starsToOpen: 14, icon: '🇺🇸' },
  { id: 'europe', topic: 'europe', types: { map: 1 }, ramp: RAMP_MID, starsToOpen: 30, icon: '🏰' },
  { id: 'flags_1', topic: 'world', types: { flag: 1 }, ramp: RAMP_EASY, starsToOpen: 46, icon: '🚩' },
  { id: 'americas', topic: 'americas', types: { map: 0.8, flag: 0.2 }, ramp: RAMP_MID, starsToOpen: 62, icon: '🌎' },
  { id: 'asia', topic: 'asia', types: { map: 0.8, name_to_flag: 0.2 }, ramp: RAMP_MID, starsToOpen: 78, icon: '🏯' },
  { id: 'usa_2', topic: 'usa', types: { map: 1 }, ramp: RAMP_HARD, starsToOpen: 94, icon: '🗽' },
  { id: 'africa', topic: 'africa', types: { map: 0.8, flag: 0.2 }, ramp: RAMP_MID, starsToOpen: 110, icon: '🦁' },
  { id: 'flags_2', topic: 'world', types: { flag: 0.7, name_to_flag: 0.3 }, ramp: RAMP_HARD, starsToOpen: 126, icon: '🏳️' },
  { id: 'oceania', topic: 'oceania', types: { map: 0.7, flag: 0.3 }, ramp: RAMP_MID, starsToOpen: 142, icon: '🏝️' },
  { id: 'expert', topic: 'world', types: { map: 0.6, flag: 0.2, name_to_flag: 0.2 }, ramp: RAMP_EXPERT, starsToOpen: 158, icon: '🧭' },
];

export type LevelDef = {
  id: string;            // "world_famous-3"
  chapter: string;
  chapterIndex: number;
  index: number;         // 0-based inside the chapter
  globalIndex: number;   // 0-based along the whole Journey
  topic: Topic;
  types: Partial<Record<QType, number>>;
  mix: TierMix;
  boss: boolean;
};

export const LEVELS: LevelDef[] = CHAPTERS.flatMap((c, ci) =>
  c.ramp.map((m, i) => ({
    id: `${c.id}-${i + 1}`,
    chapter: c.id,
    chapterIndex: ci,
    index: i,
    globalIndex: 0,
    topic: c.topic,
    types: c.types,
    mix: TIER_MIX[m],
    boss: i === c.ramp.length - 1,
  })),
).map((l, i) => ({ ...l, globalIndex: i }));

export const LEVEL_BY_ID: Record<string, LevelDef> = Object.fromEntries(LEVELS.map((l) => [l.id, l]));

/** The very first round: the video, playable. */
export const FIRST_ROUND = { topic: 'world' as Topic, types: { map: 1 }, mix: TIER_MIX.ve, firstIds: ['US', 'BR', 'AU'] };

/** Daily Challenge: same for everyone; seeded by the date. */
export const DAILY_RECIPE: { topic: Topic; type: QType; count: number }[] = [
  { topic: 'world', type: 'map', count: 6 },
  { topic: 'world', type: 'flag', count: 2 },
  { topic: 'usa', type: 'map', count: 2 },
];

/** Quick Play menu: like the video formats. */
export const QUICK_TOPICS: { id: string; topic: Topic; type: QType }[] = [
  { id: 'world_map', topic: 'world', type: 'map' },
  { id: 'usa_map', topic: 'usa', type: 'map' },
  { id: 'world_flags', topic: 'world', type: 'flag' },
  { id: 'europe_map', topic: 'europe', type: 'map' },
  { id: 'asia_map', topic: 'asia', type: 'map' },
  { id: 'africa_map', topic: 'africa', type: 'map' },
  { id: 'americas_map', topic: 'americas', type: 'map' },
  { id: 'oceania_map', topic: 'oceania', type: 'map' },
  { id: 'europe_flags', topic: 'europe', type: 'flag' },
  { id: 'pick_flag', topic: 'world', type: 'name_to_flag' },
];

export const TIERS: Tier[] = ['very_easy', 'easy', 'medium', 'hard', 'very_hard'];
