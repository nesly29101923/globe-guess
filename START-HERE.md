# Start here (Nesly)

This folder is everything Claude Code needs to build our trivia game well. It holds the game-design
knowledge, so your Claude doesn't have to guess what makes a game feel like a game.

## What to do

1. Copy this whole folder next to the studios on your computer and rename it `trivia-game`, so it sits
   beside `guessyourflag`:

       guessyourflag/
       trendforge-hub/
       trivia-game/        <- this folder (CLAUDE.md, PROMPT.md, docs/)

2. Open a terminal in `trivia-game` and start Claude Code there.
3. Open `PROMPT.md`, copy everything under the line, and paste it as your first message.
4. That's all. Claude builds the whole game by itself: it makes its own decisions, tests its own work and
   does not ask you anything. You don't need to reply.

Two things can still interrupt it, and neither needs a real answer:
- **Permission pop-ups** ("allow this command?"). To avoid them, turn on auto-accept in Claude Code before
  pasting, or start it with `claude --dangerously-skip-permissions` (it then runs every command without asking,
  so only use it for this project).
- **It stops before the game is finished** (long builds can run out of session). Start Claude Code in the
  same folder again and type `continue`. It picks up from its own notes.

When it is done you will find `HANDOFF.md` in the folder: how to run the game, what it built, what it decided,
and the few things only a person can do (store accounts, ad keys, trying it on a real phone).

## What is in here

| File | What it is |
|---|---|
| `PROMPT.md` | The first message to paste into Claude Code |
| `CLAUDE.md` | Standing rules Claude Code reads automatically in every session |
| `docs/01-VISION.md` | Why this game exists, who plays it, how the videos feed it |
| `docs/02-GAME-DESIGN.md` | The loop, modes, progression, daily systems |
| `docs/03-ECONOMY.md` | Coins, XP, prices, rewards, and how to balance them |
| `docs/04-FEEL-AND-UI.md` | What makes it feel like a game: feedback, sound, motion, UI rules, the look from our videos |
| `docs/05-MONEY-AND-ANALYTICS.md` | Ads, purchases, events to track |
| `docs/06-TRENDFORGE-REUSE.md` | What to take from `guessyourflag` (maps, flags, difficulty tiers, colours, sounds) |
| `docs/07-BUILD-PLAN.md` | Milestones in order, and what "done" means for each |
| `docs/extra/` | Empty. Drop any extra notes or design files here; Claude reads them and they win over the docs |

## Files Claude creates while working

`PROGRESS.md` (what is done and what is next), `DECISIONS.md` (every choice it made and why), `HANDOFF.md`
(the summary at the end).
