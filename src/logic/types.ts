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
 *  of the highlighted place. */
export type QuestionType = 'map' | 'flag' | 'name_to_flag' | 'capital';

export type Question = {
  itemId: string;
  scene: Scene;
  type: QuestionType;
  tier: Tier;
  options: string[];      // item ids, in button order
  answer: number;         // index into options
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
