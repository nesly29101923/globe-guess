# Progress

## Done (all six milestones)
1. **One great round** — data tool, synthesised sounds, the videos' look, smooth-zoom camera, title card, dots, timer ring
   with tick-tock, 2x2 answers, combo, reveal pill, score pops, result in beats, 9:16 share card.
2. **Rewards and progression** — coins, XP, levels with full-screen level-ups, flags and US states, versioned saves with
   migrations and backup, `src/config/balance.ts`, `tools/balance_sim` (all checks pass, REPORT.md).
3. **Journey and Atlas** — 11 chapters x 10 levels, stars, bosses, chapter chests, hearts; Atlas with discovery, mastery,
   region rewards and a world that fills with colour; first-time flow (question 1 on screen with no menu, round 1 ->
   level 2 -> home); home screen.
4. **Daily systems** — Daily Challenge (date-seeded, shareable grid), streak with freezes, milestones and repair, 7-day
   login calendar that pauses, 3 daily missions + chest, local reminders. Fake-clock tests: 7 days, midnight, time-zone
   change, clock set back.
5. **Depth** — Quick Play (10 topics x 6 difficulties), Survival (3 lives, climbing tiers, ad continue), power-ups with
   free teaching moments (50/50, Freeze, Skip, Second chance), shop with themes and button styles, settings.
6. **Money and launch readiness** — ads / purchases / analytics / remote config behind services with fakes, real AdMob +
   RevenueCat adapters, consent and tracking flows, analytics events from docs/05, icon, splash, store screenshots,
   listing, privacy policy, EAS profiles; `expo prebuild` generates both native projects cleanly.

## Self-review (last pass)
- New player from a video: first question ~3 s after launch, same title card, purple country, ring and tick-tock as
  the video; the first round is all "I know this!" and ends in a level-up storm, 10 Atlas cards and "Continue".
- Day-7 player: home shows streak flame, 3 missions with bars, Daily Challenge ready dot, login calendar dot, chapter
  stars "N to open Europe", free-coins button; always something to claim or nearly unlocked.
- Fixed during review: Survival soft-lock on a miss, reminder prompt appearing over a round, answer pill flashing the
  next answer, buttons visible during the camera flight, "Play again" keeping the old result, double-advance on slow
  devices, label truncation, 999,999 shown as "1000K", missions not counting the first two rounds.

## Known issues / not verifiable here
- 60 fps on a mid-range Android could not be measured: this computer only has software rendering for the web preview
  (5-15 fps there). The map is built for it (static land layer, levels of detail, fine detail only near the target),
  but it must be checked on a real phone.
- Native builds were generated (`expo prebuild`) but not compiled: no Android SDK or Xcode here.
- Round 2: haptics, dark mode, pause/settings, level rewards, result scroll fix (31 tests pass).
- Round 3: map and app-wide performance, icons instead of emoji, type scale and equal HUD heights, equal answer sizes,
  no-scroll home / result / Journey / Quick Play / Atlas, shop tabs, explained free coins (see DECISIONS.md). Checked in
  the web preview at 390x844, 390x763 and 390x667, light and dark; fps still needs a real phone.
- Round 4 (after the first iPhone run): FPS counter, theme context + cached styles, glow by layer opacity, ledges
  instead of shadows, lean home (Today / Modes sheets), lean round and result. Next: read the FPS counter on the
  phone per screen (UI vs JS) and fix what it shows.
