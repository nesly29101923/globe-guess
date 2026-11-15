# 04. Feel and UI

This is the part that separates a game from an app. An app shows the right information. A game reacts to
everything the player does, with more energy than the action deserved. When in doubt, add feedback.

## Feedback rules ("juice")

1. **Every tap answers within 100 ms** with three things at once: something moves (the button presses down
   and springs back), something sounds, something vibrates (light haptic). No tap is ever silent or still.
2. **Nothing appears or disappears instantly.** Screens, cards, buttons, numbers: all pop, slide or fade in
   150-300 ms with a little overshoot (spring), and leave faster than they arrive.
3. **Numbers never jump; they count.** Score, coins, XP roll up to their new value. Coins physically fly from
   where they were earned to the counter, and the counter bumps when they land.
4. **Right and wrong are unmistakable in a quarter of a second**, without reading: colour (green/red), motion
   (pop/shake), sound (rising chime/soft thud), haptic (success/error pattern).
5. **Escalate.** The 5th right answer in a row must feel bigger than the 1st: higher pitch, bigger combo
   number, glow or particles at x3 and above, a flame at x5. Three stars feels bigger than one. A level-up or
   chest is a full-screen moment with confetti.
6. **Celebrate in beats, not all at once.** On the result screen each reward gets its own half-second. A wall
   of simultaneous numbers reads as a report; a sequence reads as winning.
7. **Losing is gentle and useful.** Soft sound, short shake, then immediately show the right answer and the
   place's name. Follow with a way forward ("Try again", "1 more for 2 stars"). Never a dead-end "You failed".
8. **Tension before the reveal.** The tick-tock speeds up and the ring turns green -> amber -> red in the last
   seconds, exactly like the videos.
9. **Idle screens are alive.** The home screen breathes: the primary button pulses slowly, the streak flame
   flickers, a chest that can be opened wobbles, a red dot sits on anything claimable.
10. **Always show the next goal.** Any screen where the player might put the phone down shows something close:
    "2 stars to the next chapter", "Mission 2/3", "Level 7 in 40 XP".

## Sound and haptics

- Sounds: button tap, answer buttons pop-in, tick and tock (reuse the studio's two clock samples), correct
  (pitch rises with the combo, about one semitone per step, capped), wrong, timeout, whoosh for the camera
  move, star pop (three rising notes), coin pickup (rapid, slightly randomised pitch), count-up tick, level-up
  fanfare, chest open, streak flame, new Atlas card. Short, soft, no licence problems: synthesise them or use
  CC0 sources and keep a `LICENSES.md`.
- The game must be fully playable and satisfying with sound off (many players are muted): visuals and haptics
  carry it alone. Separate toggles for sound, music and haptics in settings; no music by default at launch
  unless it is very light.
- Haptics: light on taps, success pattern on correct, error pattern on wrong, heavier on stars and level-up.

## The look: take it from the videos

A viewer who installs the game must recognise it. The studio's theme (`../guessyourflag/themes/default.toml`)
is the style sheet. Copy the values into `src/theme/`; do not invent a new look.

| Element | Value from the videos |
|---|---|
| Font | Poppins: Black for titles and numbers, ExtraBold/Bold for buttons, SemiBold for small text (files in the studio's `assets/fonts`, OFL licence) |
| Sea | Vertical gradient `#CFE6F7` -> `#B4D6F2`, faint white graticule lines |
| Land in the quiz | `#FFFDF9` with `#8C9DB0` edge, offset shadow `#9CC3E4` (paper cut-out look) |
| Other land | `#E6EBF0` with `#B8C4D0` edge |
| Target (the question) | Purple `#7C3AED`, edge `#4C1D95`, soft pulsing glow |
| Correct | Green `#16A34A`, edge `#14532D`; already-answered areas tinted `#BBF7D0` |
| Wrong | Red `#DC2626` |
| Cards, buttons, pills | White, corner radius about 30-48 on a 1080-wide design, soft dark shadow (`#0F172A` at ~20 % opacity, blur 22, 10 down) |
| Text | Ink `#0F172A`, secondary `#64748B`, chips `#EEF2F7` |
| Accent | Purple `#7C3AED` (letter badges A-D, highlights, the primary button) |
| Tier colours | very easy `#16A34A`, easy `#0EA5E9`, medium `#F59E0B`, hard `#F97316`, very hard `#DC2626` |
| Timer ring | White disc, track `#E2E8F0`, ring green `#22C55E` -> amber `#F59E0B` -> red `#EF4444`, big number that bumps each second |
| Title card | White rounded card at the top: "WHAT COUNTRY IS THIS?" in capitals, with chips for topic and tier |
| Answer buttons | 2 x 2 white buttons with a letter badge; the right one blinks green about 3 times a second for a second, the others fade to 35 % |
| Progress | A row of dots (done green, current purple, to-do white) with "3/10" |

Watch one or two finished videos in `../_reference-videos/` (01 to 04) or the studio's `out/` folder if they
exist on this computer, and render a still from the studio (its `CLAUDE.md` has the one-line command) to
compare your screens against.

Extend the look to the screens the videos don't have (home, journey path, Atlas, shop, result) using only
these colours, shapes and the font, so they read as the same product. Coins get one warm gold
(`#F59E0B` family); that is the only new colour family.

## UI rules

**Consistency**
- Every new screen must look like it always belonged. Before building a screen, look at the two existing
  screens closest to it and reuse their components. If the game never does something (a gradient title, an
  outline, a new colour, a second font), do not start now.
- Keep a living `docs/UI_STYLE.md` with the components that exist (button sizes, card styles, popup pattern)
  and add to it when a new pattern is approved.

**Text**
- No text overflow or cut-off, ever. Long country names exist ("Democratic Republic of the Congo", "Saint
  Vincent and the Grenadines"): buttons auto-shrink text down to a readable minimum, then wrap to two lines.
  Test with the longest names in the data, in every supported language, and with big numbers (999,999).
- One number formatter for the whole game (1,234 and 1.2K). One timer formatter.
- Uppercasing must be locale-safe (Turkish i/İ breaks naive upper-casing): never upper-case keys or ids, and
  upper-case display text with the right locale.

**Layout**
- Portrait only. Respect safe areas (notch, home indicator); only backgrounds go edge to edge. Check a small
  phone, a tall phone and a tablet.
- Answer buttons and the primary button sit in the lower half, in thumb reach. Touch targets at least 48 dp
  with clear gaps; the tappable area may be bigger than the visual, never smaller.
- One primary action per screen, visibly bigger and in the accent colour. Secondary actions are quieter.
- Never stretch or squash an image; flags keep their aspect ratio inside a white card, as in the videos.
- Disabled buttons look disabled. Popups open through one popup component: dim background, tap outside or
  Android back closes only the top one.
- Claimable things get a red dot. Locked things show what unlocks them.

**Performance** (a stutter kills the feel faster than anything)
- 60 fps during a question on a mid-range Android phone. Animate on the UI thread (Reanimated/Skia), not with
  React state per frame.
- Pre-simplify map shapes at build time and cache the drawn paths; do not rebuild geometry every frame.
- Preload sounds and fonts before the first question; no hitch on the first "correct".
- Cold start to first question in about 3 seconds on a mid-range phone.

## The "feels like a game" checklist

Go through this honestly at the end of every milestone, and fix what fails before moving on.

- [ ] A person who watched one of our videos recognises the game in one glance.
- [ ] First question is on screen within about 5 seconds of first launch, with no login, tutorial page or permission prompt before it.
- [ ] Every tap gives motion + sound + haptic within 100 ms.
- [ ] Right vs wrong is obvious without reading, and a wrong answer always shows the right one.
- [ ] Combo visibly and audibly escalates; breaking it is felt.
- [ ] The timer creates tension (colour, tick speed) in the last seconds.
- [ ] The result screen plays in beats: score count-up, stars, coins flying, XP bar, new cards, missions.
- [ ] The result screen always shows a reward just earned and a goal that is close, and the biggest button starts the next round.
- [ ] Level-ups, chests, chapter completions and streak milestones are full-screen celebrations.
- [ ] The home screen shows streak, coins, level, today's Daily Challenge and missions, and it moves when idle.
- [ ] There is always something to claim or something nearly unlocked.
- [ ] Coins have things worth buying, and prices make sense against what a round pays.
- [ ] With sound off the game still feels good.
- [ ] No text overflows with the longest names; nothing is hidden by the notch.
- [ ] No dropped frames during a question on a mid-range phone.
- [ ] After a round, you want to play another one. (Judge it honestly after playing five rounds in a row: is there a reward just earned, a goal within reach, and a reason not to stop? If not, nothing above counts.)
