# 05. Monetization and analytics

## Where the money comes from

For a casual game like this, expect most revenue from ads and a smaller part from purchases (roughly
80 / 20). So: ads must be placed well and paced carefully, and retention matters
more than any single ad, because a player who stays shows hundreds of ads and a player who leaves shows none.

## Ads

**Rewarded ads (the player chooses; these are the good ones).** Always a clear offer with the reward shown:
- Double the coins of this round (result screen).
- One more heart, or continue a Survival run once after losing the last life.
- Second chance on a wrong answer when the player has no item (at most once per round).
- Free coins on the home screen (3 per day) and a streak repair the day after a break.
- If no ad is loaded, hide the button; never show a button that fails.

**Interstitials (between rounds).**
- None in the first session and none before the player has finished 3 rounds in total.
- Then at most one every 3 rounds and never less than 90 seconds apart (both in config).
- Only at a natural break: after the result screen's celebration, when the player taps to continue. Never
  during a question, never before the rewards have been shown, never on app open.
- Never right after a rewarded ad.
- Remove Ads turns interstitials off forever.

**No banner in version 1.** It costs the look and pays little; revisit with data.

Use a mediation SDK (AppLovin MAX or AdMob mediation) behind `src/services/ads.ts`, with a fake provider in
development that shows a 2-second placeholder so the flows can be tested. Handle the consent flows the stores
and laws require: the tracking prompt on iOS (ask after the first session, not at launch), and a consent
message for European players. The audience includes children's-age viewers in practice, so do not target the
game at children in the store listing and follow the ad SDK's age settings; keep it that way and note it in `HANDOFF.md`.

## Purchases

Products and prices are in `03-ECONOMY.md`. Use a purchase service (RevenueCat is the usual choice with Expo)
behind `src/services/purchases.ts`, with a fake in development. "Restore purchases" in settings is required on
iOS. Show the shop only after the first session; show the Starter Pack once per day at most, at a calm moment.

## Analytics

Without numbers we are guessing. Send events through `src/services/analytics.ts` (Firebase Analytics is fine).
Keep names stable and lower_snake_case.

| Event | Key parameters |
|---|---|
| `first_open` | install source if available |
| `tutorial_round_start` / `tutorial_round_end` | correct, duration |
| `round_start` / `round_end` | mode, chapter, level, tier, correct, stars, score, duration, powerups_used |
| `question_answered` | mode, type, item_id, tier, correct, time_ms, chosen_id |
| `level_up` | level |
| `daily_challenge_end` | correct, score, shared |
| `streak_updated` | days, freeze_used, broken |
| `mission_completed`, `daily_reward_claimed` | id / day |
| `coins_earned` / `coins_spent` | source or sink, amount, balance |
| `ad_offer_shown`, `ad_started`, `ad_completed` | placement, type |
| `shop_opened`, `purchase_started`, `purchase_completed` | product, price |
| `share_tapped` | where |
| `notification_permission` | granted |

What we will look at first: day-1, day-7 and day-30 retention; rounds per session and sessions per day; the
share of players who finish the first round and who start a second; where in the Journey players stop; which
questions are missed most (to fix tiers); rewarded-ad uses per player per day; ad revenue per daily player.
`question_answered` data also tells us which items are really easy or hard, which should flow back into the
tiers and into the video studio.

## Coming from the videos

- The store name, icon and screenshots should match the videos (same title card, same map look) so that
  someone searching after a video recognises it.
- Support a link that opens a specific quiz (for example "today's video quiz"), so a video's caption or pinned
  comment can lead to the same questions, playable. Plan the route for it now; the hub can fill it later.
- Record the install source when the platform provides it, to learn which videos bring players.
