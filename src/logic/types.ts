export type Tier = 'very_easy' | 'easy' | 'medium' | 'hard' | 'very_hard';
export type Scene = 'world' | 'usa';
export type CardKind = 'country' | 'flag' | 'state';

export type Item = {
  id: string;
  name: Record<string, string>;
  region: string;
  quiz: boolean;
  tier: Tier | null;
  flagTier?: Tier | null;
  flag?: boolean;
  label: [number, number];
  bbox: [number, number, number, number];
  focus: [number, number, number, number];
  kmu: number;
  area_u: number;
  areaKm2?: number;
  islands: number;
  near: string[];
};

export type Mode = 'first' | 'journey' | 'daily' | 'quick' | 'survival';

/** map: name the highlighted place. flag: name the flag. name_to_flag: pick the flag. capital: name the capital
 *  of the highlighted place. bigger: which of two highlighted places is bigger. borders: which option borders the
 *  highlighted place (`subjectId`). */
export type QuestionType = 'map' | 'flag' | 'name_to_flag' | 'capital' | 'bigger' | 'borders';

export type Question = {
  itemId: string;
  scene: Scene;
  type: QuestionType;
  tier: Tier;
  options: string[];      // item ids, in button order (two for `bigger`)
  answer: number;         // index into options
  subjectId?: string;     // `borders`: the highlighted place the answer borders
  trap?: boolean;         // `bigger`: the map makes the smaller one look bigger
};

export type QuizDef = {
  mode: Mode;
  levelId?: string;
  topicLabel: string;     // chip text key, e.g. 'world'
  tierLabel: string;      // chip: tier or 'mixed'
  timer: number;          // seconds per question
  questions: Question[];
  seed: string;
};

export type Answer = {
  itemId: string;
  type: QuestionType;
  scene: Scene;
  tier: Tier;
  correct: boolean;
  chosen: number | null;  // null = timeout / skip
  timeMs: number;
  score: number;
  combo: number;
  skipped?: boolean;
};
