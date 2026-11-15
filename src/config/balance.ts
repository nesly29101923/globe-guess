// Every tuning number of the game. tools/balance_sim reads this file too.
// Anchor: 1 hour of average play = 1,500 coins (docs/03-ECONOMY.md).

export const balance = {
  anchorCoinsPerHour: 1500,

  round: {
    questions: 10,
    timerSeconds: 10,
    firstRoundTimerSeconds: 12,     // the very first round is generous
    bossTimerSeconds: 7,
    survivalTimerSeconds: 8,
    scoreBase: 100,
    speedBonusMax: 50,
    comboCap: 5,
    tickTockFastAt: 3,              // seconds left when the clock speeds up
  },

  stars: { one: 5, two: 7, three: 9 },   // correct answers out of 10

  rewards: {
    correctCoins: 2,
    correctXp: 10,
    finishCoins: 5,
    finishXp: 10,
    starFirstCoins: [5, 10, 20],         // 1st, 2nd, 3rd star of a level, each paid once
    starFirstXp: [0, 10, 20],
    replayCoinShare: 0.25,               // replay with no new star
    replayFullXpPerDay: 3,               // full XP for the first replays per day, then half
    replayXpShareAfter: 0.5,
    bossChestCoins: 100,
    bossChestXp: 100,
    chapterChestCoins: 200,
    chapterChestXp: 200,
    dailyChallengeCoins: 50,
    dailyChallengePerCorrect: 5,
    dailyChallengeXp: 100,
    survivalCoinsPerCorrect: 2,
    survivalXpPerCorrect: 10,
    survivalSoftCap: 50,                 // above it, a quarter of the value
    softCapShare: 0.25,
    newCardCoins: 5,
    newCardXp: 2,
    regionCompleteCoins: 250,
    regionCompleteXp: 100,
    quickPlayCoinShare: 1.0,
    levelUpCoins: 50,
  },

  daily: {
    loginCalendar: [50, 75, 100, 150, 200, 300, 500],   // day 7 is a chest (+ powerups)
    loginDay7Powerups: 2,
    missionsPerDay: 3,
    missionCoins: 50,
    allMissionsChestCoins: 100,
    allMissionsChestPowerups: 1,
    streakMilestones: [3, 7, 14, 30, 50, 100],
    streakMilestoneCoins: [100, 250, 500, 1000, 2000, 5000],
    streakTitleFrom: 30,
    streakFreezeMax: 2,
    streakRepairCoins: 300,
  },

  prices: {
    fiftyFifty: 60,
    freeze: 40,
    skip: 100,
    secondChance: 120,
    streakFreeze: 300,
    heartRefill: 150,
  },

  start: {
    coins: 100,
    powerups: { fiftyFifty: 1, freeze: 1, skip: 1, secondChance: 1 },
  },

  hearts: {
    enabled: true,
    max: 5,
    refillMinutes: 20,
  },

  ads: {
    interstitialEveryRounds: 3,
    interstitialMinSeconds: 90,
    interstitialMinTotalRounds: 3,       // none before this many rounds ever, and none in the first session
    rewardedFreeCoins: 100,
    rewardedFreeCoinsPerDay: 3,
    rewardedSecondChancePerRound: 1,
  },

  // XP to go from level L to L+1: 75 + 3*x*sqrt(x)*(2 + 0.05*x), x = L-1, rounded to 5 (see xpTable()).
  xp: { base: 100, a: 3, b: 2, c: 0.05, maxLevel: 100 },

  atlas: {
    masteryDays: [1, 3, 6],              // distinct days with a right answer: bronze, silver, gold
    preferUndiscovered: 0.6,             // share of picks that lean toward undiscovered items
    recentMissBoost: 2,                  // weight for items missed recently
    recentKeep: 40,                      // ids remembered per pool to avoid repeats
  },

  survival: {
    lives: 3,
    tierStepEvery: 5,                    // difficulty climbs every N right answers
    continueWithAd: 1,
  },

  powerupTeachAtLevel: { fiftyFifty: 3, freeze: 4, skip: 6, secondChance: 5 },

  unlocks: { dailyChallenge: 2, quickPlay: 3, survival: 5, shop: 2 },

  /** Something to look forward to at every level: unlocks, gifts, titles; a chest every 5 levels. */
  levelRewards: {
    2: { unlock: 'daily' },
    3: { unlock: 'quick' },
    4: { powerups: { secondChance: 1, skip: 1 } },
    5: { unlock: 'survival' },
    6: { cosmetic: 'mint' },
    7: { title: 'explorer' },
    8: { cosmetic: 'btn_bubble' },
    9: { powerups: { fiftyFifty: 2, freeze: 2 } },
    10: { coins: 300, title: 'navigator', chest: true },
    12: { streakFreeze: 1 },
    15: { coins: 500, title: 'cartographer', chest: true },
    20: { coins: 750, title: 'globetrotter', chest: true },
    25: { coins: 1000, chest: true },
    30: { coins: 1000, title: 'atlas_master', chest: true },
    40: { coins: 1500, chest: true },
    50: { coins: 2000, title: 'world_legend', chest: true },
  } as Record<number, LevelReward>,

} as const;

export type LevelReward = {
  unlock?: 'daily' | 'quick' | 'survival';
  coins?: number;
  powerups?: Partial<Record<'fiftyFifty' | 'freeze' | 'skip' | 'secondChance', number>>;
  cosmetic?: string;
  title?: string;
  streakFreeze?: number;
  chest?: boolean;
};

export type Balance = typeof balance;

export function xpForLevel(level: number): number {
  const { base, a, b, c } = balance.xp;
  const x = level - 1;
  const v = base + a * x * Math.sqrt(x) * (b + c * x);
  return Math.round(v / 5) * 5;
}

/** Precomputed XP needed from level L to L+1 (index L). */
export const XP_TABLE: number[] = Array.from({ length: balance.xp.maxLevel + 1 }, (_, l) => (l < 1 ? 0 : xpForLevel(l)));

export function softCap(value: number, cap: number, share: number = balance.rewards.softCapShare): number {
  return value <= cap ? value : cap + (value - cap) * share;
}
