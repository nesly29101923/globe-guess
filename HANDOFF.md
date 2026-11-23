# Handoff: Globe Guess

The playable version of the TrendForge map & flag trivia videos. Expo (SDK 58) + React Native + TypeScript, iOS and
Android, fully offline, no account.

## Status (16 Nov 2026)

- Repo: https://github.com/nesly29101923/globe-guess (`main`). Nesly's Windows copy:
  `C:\Users\turgu\Desktop\TrendForgeStudio\trivia-game` (local branch `master`, update with `git pull origin main`).
- Android APK works on a real phone (EAS preview build). iPhone not built yet (needs the $99 Apple Developer account).
- Round 2 (haptics, dark mode, pause sheet, XP curve, level rewards) and **round 3** (below) are on `main`,
  **not yet in an APK**. Next step: run `build-android.cmd` and send the new APK link.
- Round 3 from phone testing: map and app-wide performance work, icons instead of emoji (`@expo/vector-icons`, a new
  JS-only dependency: run `npm install`), one type scale and equal HUD heights, the four answers share one text size,
  home / result / Journey / Quick Play / Atlas fit on one screen without scrolling, shop in tabs, free coins explained
  in a sheet. Reasons in `DECISIONS.md`, rules in `docs/UI_STYLE.md`.
- 31 tests pass, `tsc` clean, balance sim checks pass.

## Building the Android APK (EAS)

- Expo account `nesly29101923`, EAS project id in `app.json` (`extra.eas.projectId`). Builds:
  https://expo.dev/accounts/nesly29101923/projects/globe-guess/builds
- Windows: double-click `build-android.cmd` (commits, then `npx eas-cli@latest build -p android --profile preview`).
  The finished build page has the APK download link; install over the old app, saves are kept.
- `preview` builds arm64 only (`eas.json` env `ORG_GRADLE_PROJECT_reactNativeArchitectures`); `production` builds both ABIs.
- Two config plugins keep the cloud build alive, don't remove them:
  - `plugins/withGradleMemory.js`: Gradle/Kotlin heap limits (the free builder was OOM-killed without them).
  - `plugins/withProguardKeep.js`: keeps Room/WorkManager classes from R8 (otherwise the app crashes on start with
    "Failed to create an instance of androidx.work.impl.WorkDatabase").
- `crash-log.cmd` (phone on USB, developer mode on) launches the app and writes `crash-log.txt` via adb.
  `install-test.cmd` installs an APK over USB.

## Round 9 notes (map performance)

- The round's map: `src/map/raster.ts` paints the land into images (world layer, one view per camera stop);
  `src/map/MapCanvas.tsx` only moves those images; `src/game/PlayScreen.tsx` decides which are on screen
  (`stops`, `flyTo`, `paintAhead`, `onZoomSettle`).
- Knobs at the top of `raster.ts`: world image width, how far the view image reaches beyond the screen, when a layer
  fades in (`FADE_IN`) or is dropped (`MAX_SHRINK`), pixel caps for large screens.
- To check on a phone: FPS counter on, play a round. Expected: UI stays at the screen's rate during camera moves.
  If a move still stutters, the "last hitch" line of the counter says which thread and how long.
- No native change in this round: `git pull` and a normal build are enough (no `prebuild --clean`).
- Scripts for the web preview: `tools/perf/README.md`. Its fps numbers are software rendering and mean nothing for
  a phone; the Skia-work-per-frame number does.

## Round 4 notes

- FPS counter: Settings (or the pause menu) > FPS counter. `UI` = drawing thread, `JS` = game logic, `ms` = longest
  frame in the last second. Component: `src/components/FpsMeter.tsx`.
- Theme: `ThemeProvider` in `src/app/_layout.tsx`; `usePalette()` / `useStyles()` read it (`src/theme/usePalette.ts`).
- Home: `Today` and `Modes` sheets in `src/game/HomeScreen.tsx`. Free coins: Shop > Coins. Atlas: button in Journey.
- What appears at which level: `balance.unlocks`.
- iPhone test build without a paid account: `npx expo prebuild -p ios --clean`, open `ios/*.xcworkspace`, personal team,
  unique bundle id, remove Push Notifications, scheme Run = Release.

## Round 3 notes (where things live)

- Map: `src/map/MapCanvas.tsx` (three canvases: land, glow, target), `flightPaths` and `glowImage` in `src/map/shapes.ts`,
  `StaticMap` for the home backdrop. The round passes `flight` and `moving` to the map.
- Icons: `src/components/Icon.tsx` (`Icon`, `Coin`, `RewardIcon`, `ICONS`). Chapter icons are icon names in `config/levels.ts`.
- Sizes: `type` and `sizes` in `src/theme/index.ts`. Popups: `Sheet` / `SheetTitle` in `components/ui.tsx`.
- Home sheets (missions, free coins, streak, Daily, level) live in `src/game/HomeScreen.tsx`.
- First thing to check on the phone: camera moves and the question screen should be smooth now; if a mid-range phone
  still drops frames during a move, the next lever is `lodFor` in `src/map/camera.ts` (switch to coarser detail sooner).

## Round 2 notes (where things live)

- Haptics: `src/feedback/haptics.ts`; only answer feedback (light/medium), last star and level-up.
- Theme: `colors` / `darkColors` in `src/theme/index.ts`; components use `usePalette()` and
  `useStyles(make_st)` from `src/theme/usePalette.ts`. New styles must take the palette, never hard-code colours.
  Setting: `save.settings.appearance` (system/light/dark). Dark mode switches the classic map to the night theme.
- Settings UI: `src/components/SettingsPanel.tsx`, used by the settings page and `src/game/PauseSheet.tsx`
  (opened by the ⚙ / ✕ buttons in a round; the timer pauses).
- Levels: `balance.levelRewards` (mode unlocks 2/3/5, power-ups, level-only cosmetics, titles, chests and coins at
  10/15/20/25/30/40/50); `src/logic/progression.ts` grants them; home shows the next reward card.
- Result screen: buttons are pinned outside the ScrollView (`ResultScreen.tsx`, `st.actions`); a tap or scroll skips the beats.

## Run it

```bash
npm install                     # also copies canvaskit.wasm for the web preview
npm run web                     # quickest look, in a browser
npx expo run:android            # dev build on an emulator/phone (needs Android Studio)
npx expo run:ios                # dev build on the simulator (needs Xcode on a Mac)
npm test && npm run typecheck   # logic tests and types
npm run sim                     # economy report -> tools/balance_sim/REPORT.md
```

Expo Go will not work (ads and purchases need native code): use a development build (`expo run:*` or
`npx eas-cli build --profile development`). Game data is already generated; to rebuild it from the studio, put
`guessyourflag` next to this folder and run `npm run build:data`.

## What was built

- **The round** (the video, playable): camera flies to the target, title card + chips, progress dots, timer ring with
  tick-tock that speeds up and goes green -> amber -> red, 2x2 answers with the timer between them, instant feedback
  (motion, sound, haptic), combo x1-x5 with rising pitch and a flame, a miss always shows the right answer on the map.
- **Result screen in beats**: score count-up, stars, coins and XP flying to the counters, XP bar, level-up / chest /
  streak / region celebrations, new Atlas cards flipping, mission ticks, near-miss line, big "Next level", share, double coins.
- **Modes**: first round (straight in, no menu) -> Journey (11 chapters, 110 levels, bosses, chests, hearts),
  Daily Challenge (level 2), Quick Play (level 3), Survival (level 5).
- **Meta**: player levels, Atlas (countries, flags, states; bronze/silver/gold mastery), streak with freezes, milestones
  and repair, login calendar, daily missions, power-ups with free teaching moments, shop (power-ups, items, 7 map themes,
  4 button styles, coin packs, Remove Ads, Starter Pack), settings, local reminders.
- **Content**: 194 countries, 194 flags, 50 US states, all tiered by the studio's difficulty data. Disputed territories are
  out of scored questions (`tools/build_game_data/overrides.json`).
- **Money & data**: ads, purchases, analytics and remote config behind `src/services/`, with fakes until keys exist.
  All analytics events from `docs/05-MONEY-AND-ANALYTICS.md` are sent.

Decisions and their reasons: `DECISIONS.md`. State of the work and the self-review: `PROGRESS.md`.

## Only a person can do this

1. **Try it on a real mid-range Android phone** and an iPhone: check 60 fps during questions, haptics, sound with the
   ringer off/on, and the notch/home indicator. The web preview here only had software rendering.
2. **Name check**: "Globe Guess" — search the App Store / Play Store and trademarks before committing
   (`src/config/app.ts`, `app.json`). Runners-up are in `DECISIONS.md`.
3. **Channel handle** for the share card: set `channelHandle` in `src/config/app.ts`.
4. **Store accounts**: Apple Developer + Google Play Console; set the bundle id/package (`com.trendforge.globeguess`
   in `app.json`) to the one you register; `npx eas-cli login`, `npx eas-cli build --profile production`.
5. **AdMob**: create the app and one rewarded + one interstitial unit per platform; put the **app IDs** into
   `app.json` (they are Google's public sample IDs now) and the **unit IDs** into `src/config/keys.ts`. Add mediation
   later if wanted. Keep "child-directed" off and don't enrol in "Designed for Families".
6. **RevenueCat**: create products `remove_ads` (non-consumable), `starter_pack`, `coins_s`, `coins_m`, `coins_l`,
   `coins_xl` (consumables) in both stores at the prices in `src/config/cosmetics.ts`, connect them in RevenueCat, put the
   public SDK keys in `src/config/keys.ts`.
7. **Firebase Analytics**: add the Firebase apps, then implement `AnalyticsProvider` (`src/services/analytics.ts`) with
   `@react-native-firebase/analytics` and register it in `src/services/real.native.ts`.
8. **Privacy policy**: fill `[COMPANY]/[EMAIL]/[DATE]` in `docs/PRIVACY.md`, host it, put the URL in
   `src/app/settings.tsx` (`PRIVACY_URL`) and in both store listings; fill the store data-safety / privacy forms (ads id,
   analytics, purchases).
9. **Store listing**: text in `store/listing.md`, screenshots in `store/screenshots/` (1284x2778), icon `assets/icon.png`.
10. **Video link (later)**: the quiz definition is a plain data object, and the app has the `globeguess://` scheme;
   "today's video quiz" from the hub can be added as a route that builds a quiz from item ids.

## Where to change things

| Change | File |
|---|---|
| Rewards, prices, timers, XP curve, ad pacing, hearts | `src/config/balance.ts` (then `npm run sim`) |
| Chapters, levels, Daily recipe, Quick Play topics | `src/config/levels.ts` |
| Themes, button styles, store products | `src/config/cosmetics.ts` |
| Colours, fonts, motion timings | `src/theme/index.ts` |
| All text | `src/i18n/strings.ts` |
| Exclusions, name fixes, tier corrections | `tools/build_game_data/overrides.json` (then `npm run build:data`) |
