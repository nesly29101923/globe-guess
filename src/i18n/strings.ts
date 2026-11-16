// Every user-facing string. English first; add a language by adding a table with the same keys.
import { getLocales } from 'expo-localization';

const en = {
  // question titles (the videos' wording)
  q_country: 'WHAT COUNTRY IS THIS?',
  q_state: 'WHAT STATE IS THIS?',
  q_flag: 'WHAT FLAG IS THIS?',
  q_pick_flag: 'WHICH FLAG IS IT?',
  hint_first: 'Tap the right answer!',
  tap_to_continue: 'Tap to continue',
  timeout: "Time's up!",
  combo: 'COMBO',
  // chips
  topic_world: 'WORLD',
  topic_europe: 'EUROPE',
  topic_asia: 'ASIA',
  topic_africa: 'AFRICA',
  topic_americas: 'AMERICAS',
  topic_oceania: 'OCEANIA',
  topic_usa: 'USA',
  topic_flags: 'FLAGS',
  topic_daily: 'DAILY',
  topic_survival: 'SURVIVAL',
  tier_very_easy: 'VERY EASY',
  tier_easy: 'EASY',
  tier_medium: 'MEDIUM',
  tier_hard: 'HARD',
  tier_very_hard: 'VERY HARD',
  tier_mixed: 'EASY TO HARD',
  tier_boss: 'BOSS',
  // result
  result_title: 'HOW MANY DID YOU GET?',
  result_perfect: 'PERFECT!',
  result_great: 'GREAT JOB!',
  result_good: 'NICE!',
  result_fail: 'SO CLOSE!',
  result_daily: 'DAILY DONE!',
  result_survival: 'RUN OVER',
  score: 'SCORE',
  best: 'BEST',
  new_best: 'NEW BEST!',
  coins: 'Coins',
  xp: 'XP',
  level: 'Level',
  lvl: 'LV',
  next_level: 'Next level',
  play_again: 'Play again',
  try_again: 'Try again',
  continue: 'Continue',
  home: 'Home',
  share: 'Share',
  double_coins: 'Double coins',
  double_short: '2× coins',
  watch_ad: 'Watch ad',
  near_miss_stars: '{n} more right for {stars} stars',
  near_miss_one: '1 more right answer for {stars} stars',
  new_cards: 'New Atlas cards',
  new_tag: 'NEW',
  copied: 'Copied',
  mastery_up: 'Mastery up',
  missions: 'Missions',
  heart_lost: '−1 heart',
  level_up: 'LEVEL UP!',
  level_reached: 'Level {n}',
  next_reward: 'Level {n}: {reward}',
  title_level_explorer: 'Explorer',
  title_level_navigator: 'Navigator',
  title_level_cartographer: 'Cartographer',
  title_level_globetrotter: 'Globetrotter',
  title_level_atlas_master: 'Atlas Master',
  title_level_world_legend: 'World Legend',
  level_gift: 'Level reward',
  unlocked: 'UNLOCKED',
  unlock_daily: 'Daily Challenge',
  unlock_quick: 'Quick Play',
  unlock_survival: 'Survival',
  chest_title: 'CHAPTER COMPLETE!',
  chest_open: 'Open',
  collect: 'Collect',
  region_complete: '{region} complete!',
  // streak
  streak: 'Streak',
  streak_day: '{n}-day streak',
  streak_none: 'Start a streak',
  streak_started: 'Streak started!',
  streak_extended: 'Streak +1',
  streak_froze: 'Streak Freeze saved your streak!',
  streak_broken: 'Your {n}-day streak ended',
  streak_repair: 'Repair streak',
  streak_milestone: '{n}-DAY STREAK!',
  streak_tomorrow: 'Play tomorrow to keep it',
  streak_today: 'Play a round today to keep your streak',
  // home
  play: 'PLAY',
  journey: 'Journey',
  daily_challenge: 'Daily Challenge',
  daily_ready: "Today's quiz is ready",
  daily_done: 'Done · next in {time}',
  daily_locked: 'Unlocks at level {n}',
  quick_play: 'Quick Play',
  survival: 'Survival',
  survival_desc: '3 lives · how far can you go?',
  quick_desc: 'Pick a topic, like the videos',
  atlas: 'Atlas',
  shop: 'Shop',
  settings: 'Settings',
  free_coins: 'Free coins',
  free_short: 'Free',
  free_coins_body: 'Watch a short video and get {n} coins. Spend coins in the shop on power-ups and map themes.',
  free_coins_left: '{n} of {max} left today',
  free_coins_none: 'All used today. New ones tomorrow.',
  free_coins_unavailable: 'No video right now. Try again in a bit.',
  watch_video: 'Watch video',
  daily_short: 'Daily',
  missions_short: 'Missions',
  reward_short: 'Rewards',
  streak_short: 'Streak',
  offer_short: 'Offer',
  journey_short: 'Journey',
  quick_short: 'Quick',
  survival_short: 'Survival',
  lv_short: 'LV {n}',
  missions_reset: 'New missions in {time}',
  daily_challenge_desc: 'The same 10 questions for every player today. One try.',
  daily_play: 'Play today\'s quiz',
  streak_info: 'Play at least one round every day. Miss a day and the streak starts over.',
  streak_freezes: 'Streak Freezes: {n}',
  streak_freeze_info: 'A Streak Freeze saves the streak on a day you miss.',
  level_title: 'Level {n}',
  level_info: 'Earn XP with every right answer. Every level gives a reward.',
  coming_rewards: 'Coming rewards',
  xp_to_go: '{xp} XP to go',
  level_short: 'Level {n}',
  boss_level: 'Boss level',
  chapter_stars: '{have}/{max} stars',
  login_title: 'Daily reward',
  login_day: 'Day {n}',
  claim: 'Claim',
  claimed: 'Claimed',
  all_missions_chest: 'All 3 done: chest!',
  mission_correct_answers: 'Get {n} right answers',
  mission_correct_answers_big: 'Get {n} right answers',
  mission_play_rounds: 'Finish {n} rounds',
  mission_three_stars: 'Finish a level with 3 stars',
  mission_combo: 'Reach a x{n} combo',
  mission_discover: 'Discover {n} new cards',
  mission_flags_right: 'Name {n} flags',
  mission_daily_challenge: 'Play the Daily Challenge',
  mission_journey_levels: 'Pass {n} Journey levels',
  mission_quick_rounds: 'Play {n} Quick Play rounds',
  mission_survival_correct: 'Get {n} right in Survival',
  goal_level: 'Level {n} in {xp} XP',
  goal_chapter: '{n} more stars open {chapter}',
  goal_boss: 'Beat the boss to go on',
  goal_atlas: '{have}/{total} {region}',
  // journey
  chapter: 'Chapter {n}',
  chapter_world_famous: 'World Famous',
  chapter_usa_1: 'USA States I',
  chapter_europe: 'Europe',
  chapter_flags_1: 'World Flags I',
  chapter_americas: 'Americas',
  chapter_asia: 'Asia',
  chapter_usa_2: 'USA States II',
  chapter_africa: 'Africa',
  chapter_flags_2: 'World Flags II',
  chapter_oceania: 'Oceania & Islands',
  chapter_expert: 'Expert World',
  locked_stars: 'Needs {n} stars',
  locked_boss: 'Beat the boss first',
  locked_open_with: 'Opens at {n} stars · you have {have}',
  chapter_back_to: 'Chapter {n}',
  boss: 'BOSS',
  hearts: 'Hearts',
  hearts_empty: 'Out of hearts',
  hearts_next: 'Next heart in {time}',
  hearts_refill: 'Refill',
  hearts_ad: '+1 heart',
  hearts_other_modes: 'Other modes are always free to play',
  // atlas
  atlas_title: 'Atlas',
  atlas_countries: 'Countries',
  atlas_flags: 'Flags',
  atlas_states: 'US States',
  atlas_discovered: '{n} discovered',
  region_europe: 'Europe',
  region_asia: 'Asia',
  region_africa: 'Africa',
  region_americas: 'Americas',
  region_oceania: 'Oceania',
  region_usa: 'US States',
  region_flags: 'Flags',
  mastery_bronze: 'Bronze',
  mastery_silver: 'Silver',
  mastery_gold: 'Gold',
  undiscovered: '???',
  // quick / survival
  quick_title: 'Quick Play',
  pick_topic: 'Topic',
  pick_tier: 'Difficulty',
  start: 'START',
  qt_world_map: 'World countries',
  qt_usa_map: 'US states',
  qt_world_flags: 'World flags',
  qt_europe_map: 'Europe',
  qt_asia_map: 'Asia',
  qt_africa_map: 'Africa',
  qt_americas_map: 'Americas',
  qt_oceania_map: 'Oceania',
  qt_europe_flags: 'Europe flags',
  qt_pick_flag: 'Pick the flag',
  lives: 'Lives',
  survival_continue: 'Continue with 1 life',
  end_run: 'End run',
  survival_reached: 'You reached {n}',
  // power-ups
  pu_fiftyFifty: '50/50',
  pu_freeze: 'Freeze',
  pu_skip: 'Skip',
  pu_secondChance: '2nd chance',
  pu_fiftyFifty_desc: 'Removes two wrong answers',
  pu_freeze_desc: 'Stops the timer',
  pu_skip_desc: 'Counts as right for stars, no coins',
  pu_secondChance_desc: 'Try again after a miss',
  pu_free_try: 'Free! Try it',
  pu_teach_fiftyFifty: 'Tricky one! Use a free 50/50',
  pu_teach_freeze: 'Need time? Freeze the clock, free',
  pu_teach_secondChance: 'Free second chance!',
  pu_teach_skip: 'Skip this one, free',
  second_chance_title: 'Second chance?',
  // shop
  shop_title: 'Shop',
  shop_powerups: 'Power-ups',
  shop_items: 'Items',
  shop_themes: 'Map themes',
  shop_buttons: 'Button styles',
  shop_coins: 'Coin packs',
  shop_more: 'More',
  shop_maps_short: 'Maps',
  shop_buttons_short: 'Buttons',
  shop_coins_short: 'Coins',
  streak_freeze: 'Streak Freeze',
  streak_freeze_desc: 'Saves your streak on a missed day (max {n})',
  heart_refill: 'Refill hearts',
  owned: 'Owned',
  equip: 'Use',
  equipped: 'In use',
  buy: 'Buy',
  not_enough: 'Not enough coins',
  remove_ads: 'Remove Ads',
  remove_ads_desc: 'No more ads between rounds. Rewarded ads stay optional.',
  starter_pack: 'Starter Pack',
  starter_desc: '2,000 coins · 3 of each power-up · Neon map · 7 days without ads',
  one_time: 'One time only',
  most_popular: 'Most popular',
  best_value: 'Best value',
  bonus: '+{n}%',
  restore: 'Restore purchases',
  purchase_done: 'Thank you!',
  theme_classic: 'Classic',
  theme_mint: 'Mint',
  theme_sunset: 'Sunset',
  theme_night: 'Night',
  theme_parchment: 'Parchment',
  theme_neon: 'Neon',
  theme_arctic: 'Arctic',
  theme_royal: 'Royal',
  btn_classic: 'Classic',
  btn_bubble: 'Bubble',
  btn_ink: 'Ink',
  btn_gold: 'Gold',
  starter_only: 'Starter Pack',
  // settings
  settings_title: 'Settings',
  sound: 'Sound',
  music: 'Music',
  haptics: 'Vibration',
  notifications: 'Reminders',
  language: 'Language',
  appearance: 'Appearance',
  appearance_system: 'Auto',
  appearance_light: 'Light',
  appearance_dark: 'Dark',
  pause_title: 'Paused',
  resume: 'Resume',
  quit_round: 'Quit round',
  privacy: 'Privacy policy',
  privacy_choices: 'Privacy choices',
  version: 'Version {v}',
  credits: 'Credits',
  credits_text: 'Maps: Natural Earth (public domain). Flags: flag-icons (MIT). Font: Poppins (OFL). Clock sounds: CC0.',
  // notifications
  notif_ask_title: 'Keep your streak alive?',
  notif_ask_body: "We'll remind you when the Daily Challenge is ready and before your streak breaks. A few times a week at most.",
  notif_yes: 'Remind me',
  notif_no: 'Not now',
  notif_daily_title: "Today's quiz is ready 🌍",
  notif_daily_body: 'Same 10 questions for everyone. Can you beat yesterday?',
  notif_streak_title: 'Your {n}-day streak ends at midnight 🔥',
  notif_streak_body: 'One quick round keeps it going.',
  notif_hearts_title: 'Hearts are full ❤️',
  notif_hearts_body: 'Your Journey is waiting.',
  // ads
  ad_placeholder: 'Ad',
  ad_test: 'Test ad',
  ad_reward_ready: 'Reward unlocked!',
  // consent
  consent_title: 'Your privacy',
  consent_body: 'We show ads to keep the game free. You choose whether ads may be personalised. You can change this anytime in Settings.',
  consent_accept: 'Accept',
  consent_decline: 'Only necessary',
  // share
  share_text: 'I got {correct}/{total} on {app}! Can you beat me? 🌍',
  share_card_line: 'Can you beat my score?',
  share_comment: 'Comment your score!',
  // misc
  close: 'Close',
  back: 'Back',
  locked: 'Locked',
  coming: 'Soon',
  time_h_m: '{h}h {m}m',
  time_m_s: '{m}m {s}s',
  free: 'FREE',
  title_streak_30: 'On Fire',
  title_streak_50: 'Unstoppable',
  title_streak_100: 'Legend',
  title_chapter: 'Master of {chapter}',
};

export type StringKey = keyof typeof en;

const tables: Record<string, Partial<Record<StringKey, string>>> = { en };

let lang = 'en';
try {
  const code = getLocales()[0]?.languageCode ?? 'en';
  lang = tables[code] ? code : 'en';
} catch {
  lang = 'en';
}

export function currentLanguage(): string {
  return lang;
}

export function languageTag(): string {
  try {
    return getLocales()[0]?.languageTag ?? 'en-US';
  } catch {
    return 'en-US';
  }
}

export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s = tables[lang]?.[key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** Locale-safe upper case for display text (Turkish i/İ). Never use on ids or keys. */
export function upper(s: string): string {
  return s.toLocaleUpperCase(lang === 'tr' ? 'tr-TR' : languageTag());
}

const nf = (() => {
  try {
    return new Intl.NumberFormat('en-US');
  } catch {
    return null;
  }
})();

/** One number formatter for the whole game: 1,234 and 12.3K. */
export function fmt(n: number, compact = false): string {
  const v = Math.round(n);
  if (compact && Math.abs(v) >= 999500) return `${Math.round(v / 100000) / 10}M`;
  if (compact && Math.abs(v) >= 10000) {
    const k = v / 1000;
    return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
  }
  return nf ? nf.format(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** One timer formatter: 2h 05m, 4m 09s. */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return t('time_h_m', { h, m: String(m).padStart(2, '0') });
  return t('time_m_s', { m, s: String(sec).padStart(2, '0') });
}
