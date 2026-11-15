# First message for Claude Code

Copy everything below this line and paste it as your first message.

---

We are building a mobile trivia game, and this folder holds the brief for it. Please read `CLAUDE.md` and
every file in `docs/` (including anything in `docs/extra/`) fully before you do anything else.

The background, so you understand what a good result is: we run TrendForge, a system that makes and posts
short videos automatically. Out of about ten channels, one took off: map and flag trivia ("What country is
this?", "What flag is this?"), with single videos passing a million views and roughly 20 % of the audience in
the United States. Getting installs for a new game is very hard right now, and these videos are our way
around that: viewers come from a video into the game. So the game has to be the playable version of those
videos, and the first minute has to feel exactly like the video they just watched, except now they are the
one answering.

The risk we most want to avoid: games built with an AI assistant usually come out as a working app with
quiz screens, not as a game. Correct, but flat: no feedback, no reason to play a second round, no reason to
come back tomorrow. The docs in this folder are the game design written down for you: the loop,
the economy, the daily systems, the feel, the monetization. Treat them as the design, not as suggestions. Where a doc gives numbers,
they are starting values that you check with the balance simulation described in `docs/03-ECONOMY.md`.

The video studio that makes the trivia videos is in the sibling folder `../guessyourflag` (search nearby folders if it is not there). It has the country and state shapes, 209 flags, a difficulty tier for
every country and state, the fonts, colours and sounds of the videos. `docs/06-TRENDFORGE-REUSE.md` says what
to take from it. Read that studio's `README.md`, `themes/default.toml` and `geoquiz/quiz.py` yourself too.

The stack is decided: React Native with Expo and TypeScript, for iOS and Android. Details and the reasons are
in `CLAUDE.md`. Check the current documentation of each library before you install it rather than trusting
what you remember about versions.

How I want you to work: on your own, from start to finish. Nobody will answer questions, review your work
or play-test for you during the build, so do not ask anything and do not stop to wait for a reply. When
something is undecided, make the choice an experienced mobile game designer would make, write it down in
`DECISIONS.md` with one line of reasoning, and keep going. `docs/07-BUILD-PLAN.md` already gives the defaults
for the open points (name, languages, testing, missing accounts and keys).

1. Follow the milestones in `docs/07-BUILD-PLAN.md` in order, all six, without pausing between them.
   Milestone 1 is one round of the game that already feels great. Do not build menus, shops or settings before
   that round is fun.
2. Be your own tester. Run the game as you go (simulator, emulator or the web preview, whichever works on this
   computer), take screenshots, play whole sessions, and compare what you see with `docs/04-FEEL-AND-UI.md`.
   Passing tests are not proof that it feels good; looking at it is.
3. At the end of each milestone, review it the way an experienced mobile game designer would: play it as a new
   player who just came from a video, then as a day-7 player. Go through the "feels like a game" checklist
   item by item. Fix everything that fails before starting the next milestone, then move on by yourself.
4. Keep `PROGRESS.md` current (done, next, known issues) so the work survives a restart. If a session ends or
   the context resets, read `CLAUDE.md`, `PROGRESS.md` and `DECISIONS.md` and continue where it stopped.
5. If something is truly impossible on this computer (no store account, no ad keys, no phone), do not wait for
   it: build everything up to that point with the fake service in place, note it in `HANDOFF.md`, and continue
   with the rest.

You are finished when all six milestones meet their "done when" lines and every checklist item passes. Then
write `HANDOFF.md`: how to run the game, what was built, the decisions you made, and the short list of things
only a person can do (store accounts, real ad and purchase keys, trying it on a real phone).
