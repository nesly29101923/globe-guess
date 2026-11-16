# UI style (living)

Everything comes from `src/theme/index.ts` (colours, fonts, radii, shadows, motion, **type scale**, **control sizes**)
and the videos' theme.

## Rules

- **No emoji in the UI.** Icons come from `Icon` (`components/Icon.tsx`, Material Community Icons, a font, so it costs
  what text costs). Coins are drawn with `Coin`. Rewards and power-ups use `ICONS` / `RewardIcon` so the same thing
  always has the same icon. Emoji stay only in OS text: notifications and the share text.
- **One type scale** (`type` in the theme): hero 56 (score), display 32, title 22, heading 17, body 15, label 13,
  caption 11. A role always uses the same size. No `size={14}`-style one-offs.
- **One height per row.** HUD pills and icon buttons are `sizes.hud` (44); inner circles are hud - 8 so the insets
  match. Primary button `sizes.big` (62), secondary `sizes.small` (48), home side buttons `sizes.rail`, dock `sizes.dock`.
- **No scrolling in the game loop.** Home, round, result, Journey (one page per chapter, swiped sideways), Quick Play,
  Atlas and Settings fit on one screen; layouts pick a denser variant on short phones (result: by the height left after
  safe areas). The shop scrolls inside a tab only on very small phones; the one list meant to scroll is an Atlas
  region's cards, inside its sheet.
- **Nothing important hides at the bottom of a list.** Side buttons open a sheet that says what the thing is and what
  it gives (free coins, missions, streak, Daily Challenge, level rewards).
- **Idle screens are alive only while on top**: breathing PLAY, flickering flame and wobbling gift run only when the
  screen is focused; red dots pop in once and do not pulse.
- Portrait only, game column max 520 dp, touch targets >= 48 dp, one font (Poppins), coin gold is the only colour
  family added to the videos' palette. Text through `t()`, numbers through `fmt()`, timers through `fmtTime()`.

## Components

| Component | Where | Rules |
|---|---|---|
| `Press` | components/ui.tsx | Every tappable thing. Springs to 0.93, plays `tap`, within 100 ms. |
| `BigButton` | ui.tsx | The one primary action per screen. Accent, `sizes.big`, radius 28, icon from `Icon`, breathes only when `breathe`. |
| `SmallButton` | ui.tsx | Secondary actions, `sizes.small`. `icon` (icon name) or `iconNode` (e.g. `<Coin />`). Gold = ad/coins, green = claim. |
| `Sheet` + `SheetTitle` | ui.tsx | The one popup pattern: dim, white card radius 28, max 400, icon tile + title + close button; tap outside closes. |
| `Dot` | ui.tsx | Red dot (or count) on anything claimable. Pops in once. |
| `ProgressBar`, `PopIn` | ui.tsx | Animate to their value / spring in. |
| `Icon`, `Coin`, `RewardIcon`, `ICONS` | components/Icon.tsx | All icons. |
| `CoinPill`, `LevelBadge`, `HeartsPill`, `StatPill`, `IconButton`, `ScreenHeader` | components/hud.tsx | All `sizes.hud` tall. `ScreenHeader` = back + title + right items, on every sub-screen. |
| `TitleCard`, `ProgressDots`, `TimerRing`, `AnswerButton`, `ComboBadge`, `AnswerPill`, `FlagCard`, `GridSquares` | components/round.tsx | The video look. All four answers share one text size (see PlayScreen `answerFonts`); the letter badge turns into the tick or cross on reveal. |
| `StaticMap` | map/StaticMap.tsx | A still map backdrop (home), drawn once. |
| `Celebration` | components/Celebration.tsx | Full-screen moments only. The icon sits on a white disc. |
| `fx` | components/fx.tsx | Flying coins/XP and confetti, one layer at the root. |
