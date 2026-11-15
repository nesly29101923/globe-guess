# 03. Economy and balance

The economy is what turns "I finished a round" into "I want another one". These are the rules we use on our
other games, followed by starting numbers for this one.

## Principles

1. **One anchor: an hour of play.** Decide what an average player earns in one hour of normal play, and price
   everything in hours. Here: **1 hour = 1,500 coins**. A cosmetic that costs 3,000 coins is "2 hours"; a
   purchase pack of 3,000 coins "skips 2 hours". Every price and reward must be explainable this way.
2. **Simulate before you ship.** Keep a small script (`tools/balance_sim`) that reads the same config as the
   game and prints, for a casual, an average and a skilled player: coins and XP per hour, time to each player
   level, time to finish each chapter, days to afford each cosmetic, coins held after 1, 7 and 30 days with daily
   systems included. Run it whenever a number changes and keep the last report in the repo. Do not tune by feel
   alone.
3. **Faucets and sinks must both exist from day one.** If coins only pile up they mean nothing. Sinks here:
   power-ups, streak freeze, heart refill, cosmetics.
4. **Reward first clears, soften farming.** Replaying an easy level forever must not be the best way to earn.
   Full reward the first time a star level is reached, a reduced reward on replays, and when a formula has to
   compress big values, use a soft cap (full value up to a threshold, a quarter of the value above it) rather
   than a hard cap, so big results still feel big.
5. **Score can be wild, rewards stay controlled.** Let score and combo numbers grow dramatically for the thrill;
   pay coins and XP from correct answers and stars, which are bounded.
6. **Round, clean numbers.** 50, 100, 250, 1,000. Players read them at a glance; 47 and 1,130 look like bugs.
7. **Early generosity, later patience.** The first session and first days hand out rewards fast (several
   level-ups in the first 10 minutes); the curve stretches afterwards.
8. **Everything in config.** `src/config/balance.ts`, later overridable by remote config, so we can tune a live
   game without an update.

## Currencies

- **Coins**: the one soft currency in version 1. Earned by playing, spent on the sinks above.
- **XP**: not spendable; drives player level.
- **Stars**: earned per Journey level; gate chapters.
- **Hearts**: Journey attempts.

Do not add a second premium currency in version 1. When we do (gems), this rule applies:
the harder a currency is to earn, the better its value per dollar in the shop, and each currency's packs are
sized to what that currency actually buys.

## Starting numbers (check with the sim, then adjust)

A round is 10 questions and takes about 2 minutes including the result screen, so about 30 rounds per hour.
Target average: 50 coins per round.

**Round rewards**

| Source | Coins | XP |
|---|---|---|
| Each correct answer | 3 | 10 |
| Finishing a round | 5 | 20 |
| Journey star level reached the first time | 1 star 10, 2 stars +20, 3 stars +40 (each paid once per level) | 0 / 20 / 40 |
| Journey replay with no new star | 25 % of the answer and finish coins | full XP for the first 3 replays per day, then 50 % |
| Boss level first clear | chest: 150 + one power-up | 100 |
| Chapter complete | chest: 300 + a cosmetic or title | 200 |
| Daily Challenge | 50 + 5 per correct | 100 |
| Survival | 2 per correct, soft-capped above 50 correct | 10 per correct, same soft cap |
| New Atlas card | 5 | 5 |
| Atlas region complete | 250 | 100 |

**Daily systems**

| Source | Coins |
|---|---|
| Login calendar days 1-7 | 50, 75, 100, 150, 200, 300, then a chest of 500 + 2 power-ups |
| Each daily mission | 100 |
| All three missions | chest: 200 + 1 power-up |
| Streak milestones (3, 7, 14, 30, 50, 100 days) | 100, 250, 500, 1,000, 2,000, 5,000 (plus a title at 30+) |
| Level-up | 100, plus an unlock at the levels in `02-GAME-DESIGN.md` |
| Rewarded ad: double round coins | x2 of that round's coins |
| Rewarded ad: free coins on home | 100, at most 3 per day |

**Sinks**

| Item | Price | Notes |
|---|---|---|
| 50/50 (removes two wrong options) | 60 | Max one per question |
| Freeze (stops the timer for the question) | 40 | |
| Skip (counts as correct for stars, no coins) | 100 | Not usable in Daily Challenge or Survival |
| Second chance (retry after a wrong answer) | 120 | Not usable in Daily Challenge |
| Streak Freeze | 300 | Hold at most 2 |
| Heart refill (all 5) | 150 | Or a rewarded ad for +1 |
| Map themes | 2,000 to 6,000 | A few also sold only for money or earned from streaks |
| Button styles, badges | 500 to 3,000 | |

New players start with 100 coins and one of each power-up, and the game teaches each power-up once by offering
it free at a moment it helps (for example 50/50 on the first hard question).

**XP curve**

XP needed to go from level L to L+1: `75 + 3 * x * sqrt(x) * (2 + 0.05 * x)` with `x = L - 1`, rounded to the
nearest 5 and stored as a precomputed table. With about 3,300 XP per hour of average play this gives: level 2
after the first round, level 5 in about 7 minutes, level 10 in about 25 minutes, level 20 in about 2 hours,
level 30 in about 5.5 hours, level 50 in about 23 hours. The sim must reproduce these; if real XP per hour
turns out different, adjust the coefficients to keep the times, not the other way round.

## Purchases (prices are starting points)

| Product | Price | Contents |
|---|---|---|
| Remove Ads | $3.99 | No interstitials, forever. Rewarded ads stay (they are a choice) |
| Starter Pack (one time, shown from day 2) | $1.99 | Remove Ads for 7 days + 2,000 coins + 3 of each power-up + one theme |
| Coins S / M / L / XL | $1.99 / $4.99 / $9.99 / $19.99 | 3,000 / 9,000 / 20,000 / 45,000 (bonus 0 / +20 / +35 / +50 %) |

The bigger the pack, the better the rate, always. Mark one pack "Most popular" and one "Best value". Pack sizes
line up with real goals (S is about one theme; XL is about all themes), ideally leaving the player a little
short of the next goal with the smaller pack.

## Checks the sim must print

- No source gives more coins per minute than normal Journey progress (no farming exploit).
- A player who never watches an ad and never pays can still finish the Journey and keep a streak.
- A daily player affords the first cosmetic within 2 to 3 days and still has something to save for at day 30.
- Power-up use at a sensible rate (one per two rounds) is affordable from play alone but not free.
