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
- **60 fps cap on iPhone** (`CADisableMinimumFrameDurationOnPhone: false` in app.json): a steady 60 with 16 ms per
  frame instead of chasing 120 with 8 ms; also less battery and heat. Android follows the display (not capped yet).
- **Answers**: width estimate corrected (0.78 em, real text box); a single word is always one line and shrinks itself.
  Pause is a plain icon inside the title card; the combo badge lost its translucent glow disc; FPS counter moved to the
  bottom so it covers nothing.

## Round 5 (iPhone 14 Pro play-test: feels like an app, too much text, clock out of time, hitches)
- **Clock sound**: ticks were polled every 100 ms from an arbitrary start and the player was rewound (async) just
  before playing, so beats drifted from the number and some came late. Now each beat is a timeout aimed at the next
  whole (or, in the last 3 s, half) second from the true end time; tick = the number changes. Pooled players are
  rewound after they play, so they are ready at their next turn.
- **Hitches**: parsing a country's SVG (fine map 1.25 MB) happened on the spot: the coarse world when a round opened
  and dozens of countries on the first flight over a region. Now parsed in 4 ms slices between frames: the coarse
  world/US at app start (`warmAllIdle`), each round's question areas when the round opens (`warmViews`). The FPS
  counter shows the last hitch (thread, ms, screen) so the next report pinpoints what is left.
- **Less text, more game**: home has a chapter ribbon, a bigger PLAY, a goal pill and three coloured lobby tiles.
  Today = seven day tiles (today glows and is tapped), a Daily Challenge tile with a round play button, three mission
  tiles (icon, count, coin reward; a full one turns green and is tapped). Modes = two picture tiles. Pause = three round
  switches + Home + Resume. In-round power-ups are round coloured buttons with a count badge.
- **Shop**: power-ups as a 2-column card grid; 6 new button styles (10 in all); coin packs with art that grows
  (coin, stack, sack, chest) and POPULAR / BEST ribbons; free coins as a card; the starter pack shows its contents as
  icons. **Journey**: circles shrink to fit short phones, page dots show there are more chapters, the marker that
  covered the level above is gone, empty stars visible.

## Round 6: capitals and map zoom
- **Capital questions** (`type: 'capital'`): the map flies to the place and highlights it, the title asks "Capital of
  X?", the answers are the capitals of it and its neighbours (same neighbour logic as map questions, so they are
  plausible). Data is hand-kept in `src/data/capitals.ts` (the generated map data has none): 188 countries and 50
  states. Left out: places with disputed, split or no official capital (Bolivia, South Africa, Israel, Sri Lanka,
  Eswatini, Nauru). Difficulty = the place's tier, one harder for classic traps (Canberra, Ottawa, Ankara,
  Sacramento, Albany ...). A right answer counts for the place's Atlas card.
- Where capitals appear: Quick Play (World / Europe / US state capitals); mixed into Europe, Americas, Asia,
  Africa, Oceania, USA 2 and Expert; two new all-capitals chapters at the end of the Journey (new chapters only at the
  end, so nobody's open chapters change); one question in the Daily Challenge; ~15% of Survival.
- **Zoom**: pinch (around the fingers), drag while zoomed, double-tap, and a magnifier button for one thumb; up to
  6x; springs back at each new question. The zoomed view stays inside the camera's framing, so the map never needs
  land it did not prepare for the question (no extra work, no empty areas).

## Round 7: "Which is bigger?" and "Which one borders X?"
- **Borders are computed, not taken from `near`.** `near` is only "nearest by distance" (the US list has Belize and
  the Bahamas, not Canada). `tools/build_game_data/borders.py` reads the game's own outlines: two places border when
  their outlines run within 3 km of each other for at least 15 km (outlines are simplified per place, so shared
  borders do not coincide exactly). Wrong answers must be at least 80 km apart, so a corner touch (Botswana-Zambia,
  Four Corners) or a strait can never make a "wrong" answer arguable. Never asked either way: pairs through disputed
  territory (Serbia with Albania/North Macedonia/Montenegro, Morocco-Mauritania, Somalia-Djibouti), India-Afghanistan
  (claimed via Kashmir), Singapore-Malaysia (strait), Michigan-Illinois/Minnesota (lake); Israel left out. Wrong
  answers are picked to tempt: same continent, well known, close (Brazil -> Chile, Ecuador; Texas -> Arizona).
- **Bigger**: two nearby places (so one camera shows both), purple A and orange B, the answer badges in the same
  colours. Areas must differ by at least 1.5x, so a difference between area sources can never flip the answer.
  Left out: places whose area is disputed (Morocco, Serbia, Somalia, Cyprus, Israel, Moldova, Georgia) and Michigan
  (its outline includes a lot of lake). States use map area: the US map is equal-area. When the Mercator map makes the
  smaller one look bigger (Finland v Ukraine, New Zealand v Papua New Guinea, Chile v Colombia) the question is two
  tiers harder and the reveal explains the map stretch. 50/50 is off for two-answer questions.
- Where they appear: Quick Play (Which is bigger?, World neighbours, US neighbours), mixed into Europe, Americas,
  Asia, Africa, Oceania and USA 2, a new last chapter "Neighbours", one size question in the Daily Challenge, a few
  border questions in Survival.

## Round 8: always open on the menu
- The original build dropped a new player straight into a first round (and a second) without a menu. Quitting went back
  to the start screen, which sent the player into the same round again: a loop with no way to the menu. The app now
  always opens on home; a new player's first PLAY is the guided first round, and every round can be quit from pause.
  Quitting goes back to the existing menu instead of stacking a new one. The dock tiles appear only once there is
  more than one place to go.
- The camera never shows above the top of the world map (about 84°N); it left an empty band over northern targets.

## Round 9: the map is drawn from images, not outlines ("find the big performance cause")
- **Cause.** Every frame of a camera move drew the land as outlines: 20,000 to 87,000 points, filled, shadowed and
  stroked, on three full-screen canvases. Skia has to turn outlines into triangles on the drawing thread each frame,
  so the cost grows with the map's detail, not with what changes. Measured in the web build: 14.2 ms of Skia work per
  frame, more than a whole frame at 120 Hz (8.3 ms), before the game's own UI. The frame where the camera stopped was
  worse still: it switched to anti-aliased fills and full borders in one go. Earlier rounds only trimmed this
  (levels of detail, fewer countries per flight); the approach itself was the problem.
- **Fix.** The land is painted once into images and a frame only moves images (`src/map/raster.ts`):
  - a whole-world image (4096 px wide on high-density screens, 3072 otherwise), painted while the player is on the
    home screen, a few milliseconds at a time;
  - for each camera stop, an image of exactly that view at the screen's own pixels (at rest the map is as sharp as
    outlines, pixel for pixel), plus for small countries a coarser image of the land around it;
  - painting happens on the JS thread during the reveal of the previous answer, never on the drawing thread.
  A frame of a camera move is now 2 to 6 textured rectangles: 1.4 ms of Skia work, the same on any map detail.
- Layers under a layer that covers the screen are skipped, so the GPU fills each pixel once or twice (this matters
  on cheap Android GPUs). The glow and target canvases do not redraw at all while they show nothing (flights).
- The image for a place the camera flies to **fades in** as the camera arrives. Showing it at once made a sharp
  rectangle grow in the middle of a softer picture.
- Zoom: while the fingers move the image is enlarged; when they stop, a sharp image of the zoomed view is painted.
- The place just answered is drawn as one outline during the next flight (the image the camera leaves was painted
  before the answer and has no tint for it).
- Images are freed explicitly two seconds after they leave the screen. Waiting for the garbage collector would keep
  tens of megabytes per question alive.
- Not changed: the still maps on home and in the Atlas draw outlines once and never redraw.
- **What could not be checked here.** This computer has no GPU: the web preview draws in software and stays at 15-30
  fps whatever the map does (it measures pixel filling, not what a phone does). The claim rests on the measured Skia
  work per frame and on how Skia works; the FPS counter on a real phone is the proof. `tools/perf/` has the scripts.
- Count badges on the power-up buttons were white on white in dark mode: they use a fixed dark badge colour now.

## Round 10: the menu (iPhone feedback: PLAY confused with the bottom buttons, chapter ribbon the colour of PLAY, drag only on the menu, 61 ms hitch opening the shop)
- **One loud thing on the menu.** PLAY was a purple pill among a purple ribbon and three big saturated tiles, one of
  them the same purple: nothing said "this is the button". Now the only saturated block on the screen is PLAY.
  - The chapter, its stars, the next goal (as a bar that fills) and PLAY sit in one white card: "what is next" and
    "go" are one group. Tapping the chapter line opens the Journey.
  - The places to go are a quiet white bar at the bottom (small coloured icon + name), not tiles. A new player still
    sees no bar at all, only PLAY.
  - Today (streak flame, number of things waiting) moved from a floating button over the map into that bar: the map
    is now free of buttons, which matters because it can be dragged.
- **The map is a toy on the menu, not in the round.** Drag, pinch, double-tap; it glides on when let go and a button
  (or coming back to the menu) brings it home. In a round the camera belongs to the game: pinch zoom, the magnifier
  button and the drag are gone there (`useMapZoom` deleted). Tiny countries keep their ring.
  - It draws from the same images as the round (`src/map/ExploreMap.tsx`). While it moves: a whole-world image
    painted for the menu's zoom (the fine world image has lines made for close-ups and looked washed out from far);
    zoomed in past that, the fine image; at rest, an exact view fades in.
  - The menu map no longer greys out the land outside the chapter's region. It shares the round's world image this
    way (one 25-45 MB image instead of two), and the framing already says which part of the world the chapter is.
  - Not done, worth considering: tapping a country on the menu map to see its name and flag. It would make the toy
    teach, but it also shows answers; left for a decision.
- **Shop hitch.** The shop built every card of a tab in the frame it opened, and re-rendered at once when the store
  prices arrived. Cards are now built a row per frame (`Deferred` in `components/ui.tsx`) and prices are asked for
  after the screen has opened, then remembered. Longest frame while the shop opens for the first time, web build:
  47 ms -> 21 ms. The same `Deferred` can be used on any screen that hitches when it opens.

## Round 11: tap a country on the menu, the bar lined up, and every screen checked for the shop's hitch
- **Tap a country on the menu map.** It lifts out of the map in the target colour (a quick bulge, a shadow under
  it, a ring spreading from the finger), a pop and a light tap are played, the camera glides to frame it, and a card
  hangs above it with its flag, name, capital and size. The card follows the country while the map moves. Tap the sea
  or the same country to put it back. It shows answers on purpose (decided by Ömer): the menu map is where a player
  can look things up, a round is where they are asked.
  - Double-tap zoom is gone: a tap now flies to the country, and waiting to see whether a second tap follows would
    make every tap feel late. Pinch zooms.
  - A tap next to a tiny country (within a finger's width of its label) picks it; a country inside another wins.
- **Bottom bar.** The buttons sat at the top of the bar (the bar did not centre them), the flame was pushed left by
  the streak number beside it, and it was drawn tilted 4 degrees when not animating. Every icon now sits in the same
  box in the middle of its button; the streak number and a plain red dot hang beside the flame without moving it.
- **The shop's hitch elsewhere.** Every screen and sheet was measured on its first open (web build, longest frame;
  one run varies by about 8 ms, idle is 17 ms):

  | | before | after | what was done |
  |---|---|---|---|
  | Atlas, a region's cards (Flags: 194) | 97 ms | 19 ms | first rows with the sheet, then a row per frame |
  | Atlas, a region's cards (Africa: 52) | 71 ms | 24 ms | same |
  | Atlas screen | 71 ms | 50-65 ms | the map is the menu's world image (already painted) instead of outlines; the rest is WebGL start-up, which only the web build has |
  | Level sheet | 32 ms | 18 ms | rows a frame apart |
  | Modes sheet | 31 ms | 21-26 ms | tiles one frame after the sheet |
  | Today sheet | 26 ms | 18-22 ms | challenge and missions a frame apart |
  | Journey | 22 ms | 18-28 ms | no real change on open; see below |
  | Quick Play, Settings, Result | 22-41 ms | same | no measurable change (see below) |

  - Journey: each swipe re-rendered every chapter page and all its levels, because the pages were handed new
    functions on every render. Pages and levels are memoised now and only the page that becomes (or stops being) the
    current one renders. Levels are built over three frames when the screen opens.
  - Result: the share picture was built off screen in the frame the result opened; it is built half a second later.
    What is left in that frame is the round's three canvases closing (web) and the result's own first render.
  - Quick Play and Settings are plain screens of 15-20 views; their first frame is the navigation itself.
- **Round start.** If the first question's image is not painted yet, the camera starts at once and the image is
  painted while it flies (painting is on the JS thread, the camera on the drawing thread). Before, the tap on PLAY
  waited for the paint.
- **First draw of the world image.** Drawing an image for the first time uploads it to the GPU: 25-45 MB for the
  world image, in the first frame of a round. The menu map now draws it once as an unseen dot as soon as it is
  painted, so the upload happens on the idle menu.
- `upper()` asked the phone for its locale (a native call) for every capital-letter label on every render. Asked once.
- What this cannot show: the numbers are from the web build. On the phone the FPS counter's "last hitch" line names
  the screen; that is the list to work from next.

## Sound next to the player's own music (2026-11-24)

- Effects keep the ambient session (silent switch mutes the game; Spotify and podcasts keep playing under our
  effects). Menu music now stays off while another app plays music and comes back when it stops, using the
  `modules/other-audio` native module shared with Jigsaw (iOS: `secondaryAudioShouldBeSilencedHint`; Android:
  `isMusicActive`, checked only while our music is paused).
- After a rewarded or interstitial ad closes, the audio session is set back to ambient: the ads SDK switches it
  for video ads, and left that way our next effect would stop the player's music.
