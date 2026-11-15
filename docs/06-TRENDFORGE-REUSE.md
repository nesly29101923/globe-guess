# 06. What to reuse from TrendForge

The trivia videos are made by the studio in `../guessyourflag` (Python package `geoquiz`; the hub calls it the
`trivia` child). The game does not run this code, but it takes its data, its difficulty tiers and its look.
Read the studio's `README.md`, `CLAUDE.md`, `themes/default.toml`, `geoquiz/quiz.py` and `scripts/build_data.py`.

## Data

| Studio file | Contents | Use in the game |
|---|---|---|
| `data/world.json.gz` | 258 entries, 199 marked `quiz: true`. Fields: `id` (ISO-2), `a3`, `name`, `continent`, `region`, `subregion`, `pop`, `area`, `fame`, `level` (map-quiz tier), `flag_level` (flag-quiz tier), `flag` (has a flag file), `admin1` (number of first-level regions), `admin1_type`, `polys` (lon/lat polygons) | Countries: names, regions, tiers, shapes |
| `data/admin1/<A3>.json.gz` | First-level regions per country (251 files): states, provinces, prefectures, with tiers | `USA.json.gz` for the US-states topic in version 1; other countries' provinces later |
| `assets/flags/*.svg` | 209 flags (flag-icons, MIT; keep `LICENSE-flag-icons.txt`) | Flag questions, Atlas cards |
| `assets/fonts/Poppins-*.ttf` | Poppins (OFL; keep `OFL.txt`) | The game's font |
| `assets/sounds/clock_tick.wav`, `clock_tock.wav` | Clock samples (CC0) | The countdown |
| `themes/default.toml`, `themes/night.toml` | Every colour, size and timing of the videos | The game's theme and the first extra map theme |

Tiers are the valuable part: countries are split into `very_easy`, `easy`, `medium`, `hard`, `very_hard` by a
fame score (26 / 40 / 48 / 46 / 39 of the 199), flags have their own tier (look-alike flags such as Chad and
Romania are pushed harder), and US states are hand-tiered. Use them as they are for level design; do not
re-derive difficulty. Later, real answer data from the game should correct them.

## Build tool

Write `tools/build_game_data` (Python is fine, the studio's environment already has what it needs; or Node)
that reads the studio files and writes compact game assets into `assets/data/`:

- `countries.json`: id, names, region, tiers, flag key, a label point, bounding box.
- `shapes/`: simplified polygons sized for a phone screen (much lighter than the video's; a country outline
  needs a few hundred points at most). Keep a world file for the background and per-item shapes for the target.
- `us_states.json` and its shapes.
- `flags/`: the SVGs, or pre-rendered PNGs if SVG drawing is slow on device (measure first).
- An override file in the tool for exclusions, name fixes and tier corrections (see "Sensitive content" in
  `02-GAME-DESIGN.md`).

The studio handles real map problems already; read how before re-solving them: the antimeridian (Russia,
Fiji, the Aleutians), Albers projection for the USA and high-latitude countries versus Mercator elsewhere,
tiny countries (a pulsing ring), island nations (a dot per island), very large countries filling the screen
(Russia, Canada), and the smooth zoom-out-zoom-in camera move between targets (`geoquiz/geo.py`).

## Logic worth porting (as ideas, in TypeScript)

- `_pick` in `geoquiz/quiz.py`: choosing items for a tier or a "mixed" ramp (weights in the theme:
  22 / 24 / 22 / 18 / 14 % from very easy to very hard) while avoiding recently asked items.
- The answer-options feature (README "Trivia extras"): wrong options are nearby areas of the same quiz.
- Question order modes: by difficulty for mixed rounds, nearest-neighbour "tour" so the camera travels nicely.

## Not to reuse

- The voice model (`models/`, 115 MB): far too big for an app. If we want a spoken answer later, pre-render
  short clips with the studio and ship only those.
- The video renderer, ffmpeg, the dashboard and the hub protocol: not needed in the game.
- `@guessyourflag` is a reference account, not ours. No other account's name or branding in the game.

## The other direction (later)

Each video the studio makes writes a `kit.json` with the quiz's answers. Later the hub can publish "today's
video quiz" for the game to load, so a video and the game show the same questions on the same day. Keep the
quiz definition in the game a plain data object (topic, tier, item ids, seed) so this is easy to add.
