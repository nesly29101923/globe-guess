# 07. Build plan

## Defaults for the open points (decide, do not ask)

| Open point | Default |
|---|---|
| Game name | Pick one yourself: short, says map/flag quiz, matches the videos' wording ("What country is this?"), not taken by a well-known app, no other account's name. Keep it in one config value so it can be changed in a minute. Write the three runners-up in `DECISIONS.md`. |
| Channel name and handle | Unknown. Use a single config value with a placeholder for the share card and store text; list it in `HANDOFF.md`. |
| Languages | English at launch. All text goes through the strings file so more can be added. |
| Testing | Whatever runs on this computer: iOS simulator, Android emulator, or the web preview, in that order of preference. Do not wait for a real phone. |
| Store accounts, ad and purchase keys | Not available. Keep the fake services, finish everything around them, list the missing pieces in `HANDOFF.md`. |
| `../guessyourflag` missing | Search sibling and parent folders for a folder containing `geoquiz/` and `data/world.json.gz`. If it truly isn't on the computer, clone `https://github.com/MaverickTC/guessyourflag` if access works; otherwise build the data tool against the documented format with Natural Earth data and note it in `HANDOFF.md`. |
| Anything else undecided | Choose what serves the funnel in `01-VISION.md`, record it in `DECISIONS.md`, continue. |

## Milestones

Do all six in order without pausing. Each one ends with: tests passing, the game run and looked at, a
self-review as a new player and as a day-7 player, every failing item of the checklist in `04-FEEL-AND-UI.md`
fixed, and `PROGRESS.md` updated. Then start the next one.

### 1. One great round
Project set-up, the data build tool, the theme from the videos, and a single round: 10 very easy "What
country is this?" questions with map camera, four options, timer ring, tick-tock, correct/wrong feedback,
combo, and a result screen with count-up, stars and a share card. Sound and haptics included from the start.
**Done when:** a screenshot of a question next to a still from the video reads as the same product, every
feedback rule in `04-FEEL-AND-UI.md` is present in the round, and the result screen pulls into a second round.
Nothing else gets built until this is true.

### 2. Rewards and progression
Coins, XP, player level with level-up moments, the full result-screen sequence, flag questions, US states,
save/load with versioning, the balance config and `tools/balance_sim` with its first report.
**Done when:** a round pays out visibly, numbers persist across restarts, the sim's targets are met.

### 3. Journey and Atlas
The journey path with chapters, stars, boss levels, chests and hearts; the Atlas collection with discovery
and mastery; the first-time flow from `02-GAME-DESIGN.md`; the home screen.
**Done when:** a new player goes from first launch through three levels without ever being unsure what to tap,
and the home screen always shows a next goal.

### 4. Daily systems
Daily Challenge with sharing, streak with freeze and milestones, login calendar, missions, local
notifications. All time logic tested with a fake clock (midnight, time-zone change, clock set back).
**Done when:** simulating 7 days in tests gives the expected rewards and streak, and the home screen gives a
clear reason to come back tomorrow.

### 5. Depth
Quick Play, Survival, power-ups with their teaching moments, cosmetics and the shop for coins, settings,
more question types if time allows.
**Done when:** coins have real sinks and the sim shows the economy holding for 30 days.

### 6. Money and launch readiness
Real ad and purchase SDKs behind the service interfaces, consent flows, analytics events, performance pass on
a mid-range Android phone, store assets in the videos' style (icon, screenshots, short description), privacy
policy text, test builds for both stores.
**Done when:** the ad, purchase, consent and analytics flows all work end to end with the fake services (and
with real ones wherever keys exist), a release build compiles for both platforms, every checklist item passes,
and `HANDOFF.md` is written.

## After launch (not now)

Online leaderboards and friend challenges, the "today's video quiz" link with the hub, more topics (provinces
of other countries, capitals), remote config for live tuning, more languages, tiers corrected from real answers.
