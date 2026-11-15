# 02. Game design

## Three loops

A game that keeps people has three loops running at once. Build all three; a quiz app only has the first.

| Loop | Length | What happens | What it gives |
|---|---|---|---|
| Moment | 5 s | See a shape or flag, pick an answer under time pressure, get the reveal | The "I knew it!" hit |
| Round | 60-90 s | 10 questions, score, stars, coins, XP, progress on something | A finished unit and a reward |
| Day | 3-10 min, daily | Daily Challenge, streak, login reward, missions, a few journey levels | A reason to open the app |

On top sits the long arc (weeks): finishing the Journey, completing the Atlas, levelling up.

## The question (moment loop)

One question, as in the videos:

1. Camera flies to the target on the map (0.6-1.2 s, smooth zoom out then in). Flag questions show the flag card.
2. Four answer buttons pop in. A ring timer counts down with a tick-tock.
3. The player taps. Right: the area turns green, the button turns green, coin and XP numbers pop, the combo
   counter goes up. Wrong: the tapped button shakes and turns red, the right button blinks green, the map shows
   the right area with its name. A miss must always teach the answer.
4. About 1 second later the next question starts. The player can tap to skip the wait.

Rules:
- Timer: 10 s per question in normal play (the videos use 3 s because nobody taps; a player needs time to read
  four options). Faster answers score more. Timeout counts as wrong.
- Wrong options are plausible: neighbours or same-region, same-tier items, as the studio's "options" feature
  does. Never an obviously silly option, and never two options that are both defensible.
- Combo: consecutive right answers build a multiplier on score (x1, x2, x3, capped at x5), shown big, with
  rising pitch on the "correct" sound. Breaking it is felt, not punished further.
- Score per question = base 100 x combo + speed bonus (up to 50). Score is for pride and leaderboards; coins and
  XP come from correct answers and stars, see `03-ECONOMY.md`.

### Question types

Start with the first two (they are the videos), add the others as variety in later chapters:

1. Map shape highlighted -> pick the name ("What country is this?", "What state is this?").
2. Flag shown -> pick the name ("What flag is this?").
3. Name shown -> pick the flag (four flags as options).
4. Name shown -> tap it on the map (no options; later, it needs careful touch targets for small countries).
5. Capital -> country, and "which is bigger" (later; needs extra data).

## Modes

Unlock them one at a time so the first session is simple and each unlock is an event with its own fanfare.

| Mode | Unlocks | What it is | Why |
|---|---|---|---|
| First round | First launch | The video, playable: 10 very easy world countries | Hook, guaranteed success |
| Journey | After first round | A path of levels across chapters (see below) | Progress, structure, the main coin source |
| Daily Challenge | Player level 2 | Same 10 questions for everyone that day, one scored attempt, shareable result | Daily return, sharing |
| Quick Play | Player level 3 | Pick a topic and tier like the video formats (States, World, a continent, Flags) | Freedom, replaying favourites |
| Survival | Player level 5 | Endless, 3 lives, difficulty climbs, personal best | Mastery, long sessions, "one more try" |

### Journey

- Chapters by topic, each with 10-12 levels and a final "boss" level (harder mix, shorter timer, bigger chest).
  Suggested order: World Famous (very easy countries) -> USA States I -> Europe -> World Flags I -> Americas ->
  Asia -> USA States II -> Africa -> World Flags II -> Oceania and Islands -> Expert World. Tiers rise inside
  each chapter (very easy to hard); very hard items mostly live in the later chapters and Survival.
- A level is 10 questions from a defined pool and tier. Stars: 1 star for 5+ right, 2 for 7+, 3 for 9+. Under 5
  fails the level.
- Passing with 1 star opens the next level. Chapters open with a star total, set so that an average player
  never gets stuck but perfectionists have a reason to replay.
- The path is a scrolling map with nodes, the player's marker, stars under each node, and the next chest visible
  ahead. The next goal is always on screen.
- Hearts: failing a Journey level costs one heart (5 max, one comes back every 20 minutes; refill with coins or
  a rewarded ad). Winning costs nothing. Hearts apply only to Journey; every other mode is always playable, so
  the player is never locked out of the game. If your own play sessions show hearts annoy more than they help, turn them
  off in config; nothing else may depend on them.

### Daily Challenge

- Generated on the device from the date as the seed, so everyone gets the same quiz with no server.
- One scored attempt per day; after it, the result stays on the home screen with the countdown to the next one.
- Result is shareable as text (score plus a row of green/red squares, no spoilers) and as the image card.
- Feeds the streak.

## The meta: what the player is building

### Atlas (collection)

Every country, state and flag is a card. Answering it right the first time "discovers" it, with a small card-flip
moment on the result screen. Each card has mastery (bronze, silver, gold) from repeated right answers on
different days. The Atlas screen shows the world filling with colour and counts per region ("Europe 31/44").
Region and mastery milestones pay coins and titles. This gives every single question a second meaning and gives
completionists months of goals.

The picker should lean toward undiscovered and recently missed items (within the tier) so the Atlas visibly
grows and misses get a second chance. The studio already avoids recent repeats; keep that.

### Player level

XP from every correct answer and finished round. Each level-up is a full-screen moment with a reward, and
levels unlock modes and cosmetics. Curve in `03-ECONOMY.md`.

### Cosmetics

Map themes (the studio already has a "night" theme, more are just colour sets), answer-button styles, a profile
badge/title. Cosmetic only. These are the main coin sink for long-term players and good purchase content.

## Daily systems

| System | Design |
|---|---|
| Streak | A day counts when the player finishes one round of anything. Flame icon with the number on the home screen. Milestone rewards at 3, 7, 14, 30, 50, 100 days. A Streak Freeze item (bought with coins, max 2 held) saves a missed day automatically. Losing a long streak makes people quit, so show the freeze being used as a relief moment, and offer a one-time "repair" (rewarded ad or coins) the day after a break. |
| Daily login reward | 7-day calendar, rising rewards, a chest on day 7, then it repeats. Missing a day does not reset it to day 1; it just pauses (resets feel like punishment). |
| Daily missions | 3 per day from a pool ("Get 20 right answers", "Finish a level with 3 stars", "Play the Daily Challenge", "Reach a x5 combo", "Discover 5 new cards"). One easy, one medium, one that pushes a mode. Bonus chest for all three. Progress bars visible from the home screen, and missions tick visibly on the result screen. |
| Notifications | Ask permission only after a good moment (first streak day earned, or first Daily Challenge finished), with a sentence saying why. Send few: Daily Challenge ready, streak about to break (evening), hearts full. Local notifications are enough. |

## First-time experience (the most important 60 seconds)

1. Launch -> a splash of under a second -> straight into the first question. No menu.
2. First round: 10 very easy countries, 4 options, generous timer. The first question is one almost nobody
   misses. No instruction screens; at most one line of text that disappears on the first tap.
3. Result: count-up score, stars, first coins fly to the counter, several Atlas cards discovered at once,
   level-up to level 2. Everything celebrates.
4. One button: "Continue" into Journey level 2. The home screen appears only after the second round, already
   showing a streak of 1, coins, and the Daily Challenge as "unlocks at level 2" or freshly unlocked.
5. No ads in the first session. No purchase offers in the first session. No name, no sign-in.

## Result screen (the "one more round" machine)

In order, each with its own beat (not all at once): score counts up -> stars pop one by one -> coins and XP fly
to their counters -> XP bar fills, level-up if reached -> new Atlas cards flip -> mission progress ticks ->
near-miss line if relevant ("1 more right answer for 3 stars") -> buttons: a big primary "Next level" (or
"Play again"), a small "Share", and when available "Double coins" (rewarded ad). The whole sequence is skippable
with a tap and lasts under 6 seconds unskipped.

## Sensitive content

Maps and flags are political. The studio's own review noted Taiwan and Greenland appearing in flag quizzes.
Keep an exclusion/override list in the data tool (items to leave out of questions, names to use), default to
the studio's Natural Earth naming, and keep disputed territories out of scored questions in version 1.
