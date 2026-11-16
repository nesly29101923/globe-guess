# Decisions

Every choice made while building without a reviewer, with one line of reasoning.

## Product

- **Name: Globe Guess** (store: "Globe Guess: Map & Flag Quiz"), one config value in `src/config/app.ts`. Short, says "guess the place", matches the videos' "What country is this?" wording, no other account's name. Runners-up: **Atlas Pop**, **Pin the Country**, **Map Rush**.
- **Channel handle** is a placeholder (`@CHANNEL_HANDLE` in `src/config/app.ts`), used on the share card.
- **English only** at launch; every string goes through `src/i18n/strings.ts` (`t()`, locale-safe `upper()`, one number and one timer formatter).
- **Disputed / non-sovereign places out of scored questions** (Taiwan, Kosovo, Western Sahara, Palestine, Greenland) via `tools/build_game_data/overrides.json`. They stay drawn on the map.
- **Natural Earth duplicate ISO codes** (Clipperton = FR, Baikonur = KZ, Coral Sea Islands = AU...) get unique ids in the data tool, so the country always owns its code.

## Feel

- **Layout copies the videos with options**: title card with chips, progress dots, the map, 2x2 answer buttons with the timer ring between the columns. Recognition beats novelty.
- **Timer 10 s** (12 s in the very first round, 7 s on bosses, 8 s in Survival); tick-tock doubles speed in the last 3 s with a light haptic per beat; the ring goes green -> amber -> red.
- **A miss always teaches**: the right area turns green on the map, the right button blinks, and a pill with the place's name (and flag) shows; wrong answers hold 1.7 s instead of 1.1 s. Tap-to-skip is allowed only after 0.35 s (right) / 0.75 s (wrong) so the answer is seen.
- **Combo**: multiplier = consecutive right answers, capped at x5; correct chime rises a semitone per step (8 pre-rendered pitches, no runtime pitch shifting); badge grows, glows at x3, flame at x5; breaking it plays a small descending blip.
- **All sounds synthesised** by `tools/build_game_data/sounds.py` (no licences), except the studio's CC0 clock tick/tock.
- **Map drawing**: two Skia layers, so the land only redraws while the camera moves and the pulsing target redraws every frame. Three levels of detail picked by zoom, and the finest detail is built only for the area the camera is flying to.
- **Flags are pre-rendered PNGs (320x240)** from the studio's SVGs with resvg at build time: no SVG parsing on the device, and RN Image keeps the aspect ratio inside the white card.

## Systems

- **First round is a guaranteed success**: it always opens level 2, even below 5/10 (it is the hook, not a test).
- **First round counts as Journey level 1**, so the Journey continues from it seamlessly (FTUE: round 1 -> "Continue" -> level 2 -> home).
- **Journey**: 11 chapters x 10 levels (level 10 is the boss: harder mix, 7 s timer, chapter chest = boss chest + chapter chest, a title). Chapters open with the previous boss beaten plus a star total of ~1.5 stars per previous level.
- **Hearts on** (5, one back every 20 min, Journey only). Failing costs one; winning costs nothing. Other modes are always free.
- **Daily Challenge** recipe: 6 world maps + 2 world flags + 2 US states, mixed tiers, seeded by the date only.
- **Missions**: one easy, one medium, one "push" per day from a pool, seeded by the date; the push mission only uses modes the player has unlocked.
- **Mastery**: bronze = discovered (first right answer), silver = right on 3 different days, gold = 6 days.
- **Second chance**: offered right after a miss (clock stopped) when the player owns one, or once per round with a rewarded ad (never in the first session, never in the Daily Challenge).
- **Rewards are computed in one pure function** (`finishRound`), the result screen only plays them back.

## Tech

- **Expo SDK 58**, React Native 0.88, Expo Router (routes in `src/app`), Reanimated 4, RN Skia 2.14, MMKV 4, Zustand 5, expo-audio. Versions resolved with `expo install` against the SDK.
- **Web preview** loads CanvasKit via `index.web.tsx` (`LoadSkiaWeb`) and `public/canvaskit.wasm` (copied by `postinstall`).
- **Saves**: one JSON document in MMKV, versioned (`SAVE_VERSION`), migrations never removed, missing fields filled from a fresh save; the pre-migration save is kept as a backup key.
- **Tests**: game logic is plain TypeScript with Jest (`npm test`), time passed in as a parameter (fake clock tests for midnight, time-zone change, clock set back).

## Economy (tuned with tools/balance_sim, see its REPORT.md)

- **The doc's starting rewards were ~2x too generous** once level-ups, chests, cards and daily systems are added up (an average daily player had 33k coins after 30 days with nothing left to buy). Changes: right answer 3 -> 2 coins; star first-clear 10/20/40 -> 5/10/20; boss chest 150 -> 100 and chapter chest 300 -> 200; level-up 100 -> 50; missions 100 -> 50 each and the all-missions chest 200 -> 100. Login calendar, prices and packs unchanged.
- **Two more map themes** (Arctic 7,500, Royal 9,000) so a daily player still has something to save for at day 30.
- Result: an average daily player (8 rounds + Daily Challenge) affords the first map theme on day 2, buys the last affordable theme around day 30, spends ~4,500 coins on power-ups a month, and no source pays more per minute than Journey progress (72/min vs 24/min for the best alternative). All sim checks pass.
- **XP curve kept exactly as designed** (L2 1 min, L5 7 min, L10 23 min, L20 1.9 h, L30 5.4 h, L50 23 h at 3,300 XP/h). The very first round reaches level 3 (stars and new cards add XP): "several level-ups in the first 10 minutes".

## Money

- **Ads**: AdMob (rewarded + interstitial) behind `src/services/ads.ts`; the fake shows a 2-second placeholder. Real adapter in `src/services/real.native.ts`, switched on by ad unit IDs in `src/config/keys.ts`. `app.json` carries Google's public *sample* AdMob app IDs so native builds compile; replace before release. No banner.
- **Interstitials**: never in the install's first session, never before 3 rounds in total, then at most every 3 rounds and 90 s apart, only when the player taps to continue after the result, never right after a rewarded ad.
- **Rewarded buttons are hidden when no ad is loaded** (never a button that fails).
- **Purchases**: RevenueCat adapter behind `src/services/purchases.ts`; product ids `remove_ads`, `starter_pack`, `coins_s/m/l/xl`. Starter Pack from day 2, shown as a calm home banner at most once a day, never as a pop-up.
- **Consent**: with the real SDK, Google's UMP consent message and the iOS tracking prompt run at the start of the second session; with the fakes, an in-game sheet stands in (EEA/UK/CH or iOS). "Privacy choices" in Settings reopens it.
- **Reminders** are asked after a good moment (a streak day earned or the Daily Challenge finished), on the home screen, never over a round or celebration. Local notifications only: Daily Challenge (9:00), streak at risk (19:30), hearts full.

## Smaller calls

- **Answer buttons pop in when the camera arrives**, not while it flies (the player sees the target before the options).
- **The answer pill keeps its text while fading out**, so the next question's answer can never flash on screen.
- **Second chance is not offered in Survival** (lives already forgive misses) nor in the Daily Challenge or the first round.
- **Labels never truncate**: shrink to a minimum size, then 2 lines, then 3 lines for names like "Central African Republic".
- **Menu music**: a very light synthesised loop, off by default (Settings > Music); never during a round, where the tick-tock carries the tension.
- **Hearts stay on** after self-review: only failed Journey levels cost one, every other mode stays open, and `balance.hearts.enabled = false` turns them off with nothing else depending on them. Watch the day-1 data: if many players hit 0 hearts, turn them off.
- **Android builds only compile the CPU types phones use**: arm64 for development/preview, arm64 + armv7 for production (`eas.json`). Building Skia's C++ for all four ABIs ran the free EAS worker out of memory.
- **Android builds run with 2 Gradle workers, no parallel projects and a 3 GB heap** (`plugins/withGradleMemory.js`): the default settings had the free EAS build machine kill Gradle out of memory.
- **ProGuard keep rules for Room / WorkManager** (`plugins/withProguardKeep.js`): R8 in release builds stripped `WorkDatabase_Impl`, and the app crashed at launch on a real phone (Samsung A72).

## Round 2 (phone feedback)
- Haptics cut to answer feedback + level-up/last star; success Light, error Medium.
- Dark/Light/Auto appearance via palette (`usePalette`/`useStyles`), saved in settings.appearance.
- Pause sheet (⚙ in round) holds sound/vibration/music/appearance.
- Result screen: buttons pinned outside the ScrollView; no full-screen skip overlay.
- Slower XP curve (L5 ≈ 8 min, L10 ≈ 27 min) and a reward on every level (balance.levelRewards); home shows next reward.

## Round 3 (phone feedback: performance, "feels like an app", UI consistency)
- **Map performance.** The land canvas drew the whole world at fine detail (1.25 MB of paths), twice (shadow + land),
  with anti-aliased fills and re-stroked borders on every frame of a camera move, and the target's glow was a blur
  re-computed every frame for the whole question. Now: fine and medium detail hold only the countries the camera can
  show during that flight (`flightPaths`, sampled along the van Wijk path); the coarse whole map is cached; only quiz
  land gets the shadow; while the camera moves, fills skip anti-aliasing and borders are hairlines (cheap on the GPU,
  invisible in motion), full quality returns when it stops; the glow is blurred once per question into a small image
  and only its opacity pulses, on its own canvas, so the target layer redraws only on fade-in and reveal. The round no
  longer builds the whole world at fine detail before the first question.
- **Performance everywhere.** Home re-rendered every second (a 1 s timer for countdowns) and kept doing it under the
  round; countdowns are now their own small components. Screens under the top one are frozen (`freezeOnBlur`).
  Endless animations (breathing PLAY, flame, wobble, pulsing red dots, Journey node) run only on the focused screen;
  red dots no longer pulse. The round re-rendered every second for the timer number; the number is now a tiny store
  read only by the timer. The round subscribes to the five save fields it shows, not the whole save. Count-ups update
  ~30 times a second instead of every frame. Confetti 40/24 pieces instead of 60/32.
- **Icons, not emoji.** Material Community Icons via `@expo/vector-icons` (a font: no native module, cheap to draw,
  loaded with the text fonts). Emoji render differently per phone and read as childish / app-like. Coins are drawn.
- **Type scale and control sizes** in the theme; HUD pills, coin pill (+ button) and settings button are all 44 tall.
- **Answers share one text size** (they were each fitted separately, so "BRAZIL" was bigger than "URUGUAY"). Floor 12;
  only a single word that cannot fit (LIECHTENSTEIN) gets its own smaller size instead of breaking mid-word.
- **Home without scrolling, laid out like a game lobby**: the map as backdrop framed on the current chapter, side
  buttons (streak, Daily, missions | daily reward, free coins, offer) that open sheets explaining what they give,
  the chapter card with PLAY and the next goal, a dock for Journey / Quick / Survival / Atlas / Shop. "Free coins" is now
  a visible side button with "+100" and a sheet saying what the video gives, what coins are for and how many are left.
- **Result without scrolling**: compact cards, Atlas cards in one row ("+N" for the rest), missions folded on short
  phones, the density chosen from the height left after safe areas; the Next button slides up from the bottom.
- **Journey as chapter pages** swiped sideways, ten levels winding up to the boss on one screen, instead of one
  110-level vertical scroll. **Shop in tabs** (Power-ups / Maps / Buttons / Coins). **Atlas** regions as tiles; a region's
  cards open in a sheet (the one list that scrolls). **Quick Play** fits one screen.

## Round 4 (iPhone test: still low fps with a lot of UI, screens crowded and confusing)
- **Measure first: FPS counter** (Settings and pause menu, `settings.showFps`): UI-thread fps, JS-thread fps and the
  longest frame of the last second. Which thread drops decides the next fix; without it we were guessing.
- **Theme by context, styles cached.** Every `T` and `Icon` subscribed to the store to learn light/dark, and every
  component instance built its own StyleSheet. Now one `ThemeProvider` at the root and one style table per palette.
- **Glow pulses by layer opacity.** The glow canvas redrew full-screen every frame for the whole question; it is now
  drawn once per question and its view's opacity animates (the compositor does it, no Skia redraw).
- **Ledges instead of soft shadows** (`shadow.card/soft` are now a darker bottom edge). Note: React Native already gives
  opaque views a precomputed shadow path, so shadows were not the big cost I first named; the ledge is the game look
  and the cheapest thing to draw on both platforms.
- **Celebration**: 4 bars (8 rays) with the transparency in the colour instead of 12 rays under a group opacity;
  confetti 28/18.
- **Home shows one thing to do.** PLAY with the chapter and one goal line; one "Today" button (streak, daily reward,
  Daily Challenge, missions as a checklist in one sheet, with a count of what is waiting); Journey / Modes / Shop under
  PLAY. Removed from home: free coins and the offer (now the first row of Shop > Coins, with what it gives), the
  next-reward chip (level badge opens it), Atlas (a button in Journey), the 7-day calendar popup (the Today sheet
  opens once a day instead), all locked placeholders.
- **Systems appear when unlocked, not greyed out before** (`balance.unlocks`, new `missions: 4`). Missions still
  count in the background before that; only the UI waits.
- **Round**: one-line title card, difficulty as text next to "3/10", no topic chip, power-ups only if owned or being
  taught (no "+" buttons that leave the round for the shop).
- **Result**: score, rewards with the XP bar, one line of tags (streak, new cards, missions), Next. The Atlas card
  flips and the mission bars are gone from this screen.
- **Frame drops when a popup opens (iPhone 16 Pro).** The phone draws at 120 Hz, so a frame has 8 ms, not 16.
  Three fixes: (1) Reanimated's `IOS/ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` static flags (package.json), so transform
  and opacity animations no longer go through a full React-tree commit each frame and stop colliding with the commit
  that mounts the popup; (2) sheets and `PopIn` no longer fade a whole container (off-screen drawing every frame):
  they move/scale, and only the flat dim fades; (3) own `Toggle` instead of the system switch, which sat off-centre
  on the new iOS switch size.
