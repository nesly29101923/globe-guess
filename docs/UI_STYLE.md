# UI style (living)

Everything comes from `src/theme/index.ts` (colours, fonts, radii, shadows, motion) and the videos' theme.

| Component | Where | Rules |
|---|---|---|
| `Press` | components/ui.tsx | Every tappable thing. Springs to 0.93, plays `tap`, light haptic, within 100 ms. Layout style goes on the pressable. |
| `BigButton` | ui.tsx | The one primary action per screen. Accent purple, 62 dp tall, radius 28, breathes when idle (`breathe`). |
| `SmallButton` | ui.tsx | Secondary actions, 48 dp min height, white or a semantic colour (gold = ad/coins, green = claim). |
| `Card` / white panels | ui.tsx | White, radius 22-28, `shadow.card` or `shadow.soft`. |
| `Chip` | ui.tsx | Pill 24 dp, `chip` grey or tier colour. |
| `PopIn` | ui.tsx | Everything that appears springs in (scale 0.6 -> 1). Stagger lists by 40-60 ms. |
| `Dot` | ui.tsx | Red pulsing dot on anything claimable. |
| `ProgressBar` | ui.tsx | Animates to its value (650 ms), never jumps. |
| `TitleCard`, `ProgressDots`, `TimerRing`, `AnswerButton`, `ComboBadge`, `AnswerPill`, `FlagCard` | components/round.tsx | The video look. Answer text: `fitSize` shrinks to a minimum, then wraps to 2-3 lines. |
| `CoinPill`, `LevelBadge`, `HeartsPill`, `IconButton` | components/hud.tsx | Counters count up; the coin pill is the target for flying coins and bumps on landing. |
| `Celebration` | components/Celebration.tsx | Full-screen moments only (level-up, chest, streak milestone, region, login day 7). |
| `fx` | components/fx.tsx | Flying coins/XP and confetti, one layer at the root. |
| Popups | hosts.tsx, LoginCalendar, SecondChanceSheet | Dim background `rgba(15,23,42,0.5)`, white sheet radius 28, max width 380-400, a way out ("Close"/"Not now"). |

Rules: portrait only, game column max 520 dp (tablets centre it), touch targets >= 48 dp, one font (Poppins), the only
colour family added to the videos' palette is coin gold. Text through `t()`; numbers through `fmt()`; timers through `fmtTime()`.
