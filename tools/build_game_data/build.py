"""Build the game's data from the video studio (../guessyourflag).

    python3 tools/build_game_data/build.py [--studio ../guessyourflag]

Reads the studio's Natural Earth data, tiers, flags, fonts and clock sounds and writes compact files into
assets/. Generated files are never edited by hand: change this tool or overrides.json and rebuild.

Output
    assets/data/countries.json   countries: names, continent, tiers, flag, framing, neighbours
    assets/data/us_states.json   US states: same fields
    assets/data/world_shapes.json   id -> SVG path (Mercator, K units per radian), plus graticule
    assets/data/usa_shapes.json     id -> SVG path (Albers USA), states + North American neighbours
    assets/flags/<id>.png        flags rendered to 320x240 PNG (tools/build_game_data/render_flags.mjs)
    assets/fonts, assets/sounds  copied with their licences
"""
from __future__ import annotations

import argparse
import gzip
import json
import math
import shutil
import subprocess
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon
from shapely.validation import make_valid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "assets" / "data"
K = 100.0           # projected units per radian
R_KM = 6371.0
LEVELS = ["very_easy", "easy", "medium", "hard", "very_hard"]
REGION_OF_CONTINENT = {
    "Africa": "africa", "Asia": "asia", "Europe": "europe", "North America": "north_america",
    "South America": "south_america", "Oceania": "oceania", "Seven seas (open ocean)": "oceania",
}


# ---------------------------------------------------------------- projections

def mercator(lon, lat):
    lat = max(-84.0, min(84.0, lat))
    return math.radians(lon) * K, -math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * K


class Albers:
    def __init__(self, lon0=-96.0, lat1=29.5, lat2=45.5, lat0=37.5):
        p1, p2, p0 = map(math.radians, (lat1, lat2, lat0))
        self.lon0 = lon0
        self.n = (math.sin(p1) + math.sin(p2)) / 2
        self.C = math.cos(p1) ** 2 + 2 * self.n * math.sin(p1)
        self.r0 = math.sqrt(self.C - 2 * self.n * math.sin(p0)) / self.n

    def __call__(self, lon, lat):
        lam = math.radians(((lon - self.lon0 + 180) % 360) - 180)
        rho = math.sqrt(max(self.C - 2 * self.n * math.sin(math.radians(lat)), 0)) / self.n
        th = self.n * lam
        return rho * math.sin(th) * K, -(self.r0 - rho * math.cos(th)) * K


# ---------------------------------------------------------------- geometry

def project_parts(polys, proj, wrap: float | None):
    """Projected polygons; parts across the antimeridian are moved next to the main part (Russia, Fiji)."""
    parts = []
    for poly in polys:
        rings = []
        for ring in poly:
            pts = [proj(x, y) for x, y in ring]
            if len(pts) >= 3:
                rings.append(pts)
        if rings:
            try:
                p = Polygon(rings[0], rings[1:])
                if not p.is_valid:
                    p = make_valid(p)
            except ValueError:
                continue
            if not p.is_empty and p.area > 0:
                parts.extend(_polys(p))
    if not parts:
        return []
    if wrap:
        main = max(parts, key=lambda p: p.area)
        mx = main.centroid.x
        moved = []
        for p in parts:
            dx = p.centroid.x - mx
            k = -round(dx / wrap)
            if k:
                from shapely.affinity import translate
                p = translate(p, xoff=k * wrap)
            moved.append(p)
        parts = moved
    return parts


def _polys(g):
    if isinstance(g, Polygon):
        return [g]
    if isinstance(g, MultiPolygon):
        return list(g.geoms)
    if hasattr(g, "geoms"):
        out = []
        for x in g.geoms:
            out += _polys(x)
        return out
    return []


def simplify(parts, extent):
    tol = max(0.004, min(0.06, extent * 0.004))
    out = []
    biggest = max(p.area for p in parts)
    for p in parts:
        # drop specks next to a big landmass; keep every island of small or island nations
        if p.area < tol * tol * 4 and biggest > 2.0:
            continue
        s = p.simplify(tol, preserve_topology=True)
        for q in _polys(s):
            if not q.is_empty and len(q.exterior.coords) >= 4:
                out.append(q)
    return out or parts[:1]


def coarse(parts, tol):
    """Low detail for zoomed-out views: a pixel there is several projected units."""
    biggest = max(p.area for p in parts)
    out = []
    for p in parts:
        if p.area < tol * tol * 2 and p.area < biggest:
            continue
        s = p.simplify(tol, preserve_topology=True)
        for q in _polys(s):
            if not q.is_empty and len(q.exterior.coords) >= 4:
                out.append(q)
    return out or [max(parts, key=lambda p: p.area).simplify(tol / 4, preserve_topology=True)]


def svg_path(parts) -> str:
    def ring(coords):
        pts = list(coords)[:-1]
        s = "M" + " ".join(f"{x:.2f} {y:.2f}" if i else f"{x:.2f} {y:.2f}" for i, (x, y) in enumerate(pts[:1]))
        s += "L" + " ".join(f"{x:.2f} {y:.2f}" for x, y in pts[1:]) + "Z"
        return s

    out = []
    for p in parts:
        out.append(ring(p.exterior.coords))
        for h in p.interiors:
            out.append(ring(h.coords))
    return "".join(out)


def focus_bounds(parts):
    """Main landmass plus nearby or big parts (France without French Guiana), as in the studio's geo.py."""
    info = [(*p.bounds, p.area) for p in parts]
    if len(info) <= 1:
        return list(info[0][:4])
    main = max(info, key=lambda p: p[4])
    total = sum(p[4] for p in info)
    if main[4] < 0.6 * total:
        keep = info
    else:
        mcx, mcy = (main[0] + main[2]) / 2, (main[1] + main[3]) / 2
        ext = max(main[2] - main[0], main[3] - main[1])
        keep = [p for p in info
                if math.hypot((p[0] + p[2]) / 2 - mcx, (p[1] + p[3]) / 2 - mcy) <= ext * 2.5
                or (p[4] >= 0.2 * main[4] and math.hypot((p[0] + p[2]) / 2 - mcx, (p[1] + p[3]) / 2 - mcy) <= ext * 4)]
    return [min(p[0] for p in keep), min(p[1] for p in keep), max(p[2] for p in keep), max(p[3] for p in keep)]


def r2(v):
    return round(v, 3)


def item_geo(parts, lat, mercator_proj: bool):
    allb = [min(p.bounds[0] for p in parts), min(p.bounds[1] for p in parts),
            max(p.bounds[2] for p in parts), max(p.bounds[3] for p in parts)]
    extent = max(allb[2] - allb[0], allb[3] - allb[1])
    simple = simplify(parts, extent)
    main = max(parts, key=lambda p: p.area)
    lp = main.representative_point()
    fb = focus_bounds(parts)
    kmu = R_KM * (math.cos(math.radians(lat)) if mercator_proj else 1.0) / K   # km per projected unit
    return simple, {
        "label": [r2(lp.x), r2(lp.y)],
        "bbox": [r2(v) for v in allb],
        "focus": [r2(v) for v in fb],
        "kmu": round(kmu, 4),
        "area_u": round(sum(p.area for p in parts), 5),
        "islands": len(parts),
    }


def neighbours(items, n=10):
    out = {}
    for a in items:
        ax, ay = a["label"]
        d = sorted((math.hypot(b["label"][0] - ax, b["label"][1] - ay), b["id"]) for b in items if b["id"] != a["id"])
        out[a["id"]] = [i for _, i in d[:n]]
    return out


def mean_lat(polys):
    lats = [pt[1] for poly in polys for pt in poly[0]]
    return sum(lats) / max(1, len(lats))


def graticule(step=15):
    parts = []
    for lon in range(-180, 181, step):
        pts = [mercator(lon, lat) for lat in range(-80, 81, 2)]
        parts.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts))
    for lat in range(-75, 76, step):
        pts = [mercator(lon, lat) for lon in range(-180, 181, 4)]
        parts.append("M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts))
    return "".join(parts)


# ---------------------------------------------------------------- build

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--studio", default=str(ROOT.parent / "guessyourflag"))
    ap.add_argument("--skip-flags", action="store_true")
    a = ap.parse_args()
    studio = Path(a.studio)
    if not (studio / "data" / "world.json.gz").exists():
        raise SystemExit(f"studio not found at {studio} (needs data/world.json.gz)")
    ov = json.loads((HERE / "overrides.json").read_text())
    excl = set(ov.get("exclude_questions", []))
    OUT.mkdir(parents=True, exist_ok=True)

    world = json.load(gzip.open(studio / "data" / "world.json.gz"))
    wrap = 2 * math.pi * K

    # ---- countries (Mercator)
    countries, shapes, coarse_w, medium_w = [], {}, {}, {}
    # Natural Earth reuses an ISO code for small territories (Clipperton = FR, Baikonur = KZ): the quiz entry
    # keeps the code, the others get a unique id so they stay on the map but never shadow the country.
    taken = {c["id"] for c in world if c["quiz"]}
    seen = set()
    for c in world:
        if not c.get("polys") or c["continent"] == "Antarctica":
            continue
        if (c["id"] in taken and not c["quiz"]) or c["id"] in seen:
            c = dict(c, id=f"{c['id']}_{c['a3']}_{len(seen)}", quiz=False)
        seen.add(c["id"])
        parts = project_parts(c["polys"], mercator, wrap)
        if not parts:
            continue
        lat = mean_lat(c["polys"])
        simple, g = item_geo(parts, lat, True)
        shapes[c["id"]] = svg_path(simple)
        coarse_w[c["id"]] = svg_path(coarse(parts, 0.3))
        medium_w[c["id"]] = svg_path(coarse(parts, 0.1))
        cid = c["id"]
        quiz = bool(c["quiz"]) and cid not in excl
        countries.append({
            "id": cid,
            "name": {"en": ov["names"].get(cid, c["name"])},
            "a3": c["a3"],
            "region": REGION_OF_CONTINENT.get(c["continent"], "other"),
            "subregion": c.get("subregion", ""),
            "quiz": quiz,
            "tier": ov["tiers"].get(cid, c.get("level")) if quiz else None,
            "flagTier": (ov["flag_tiers"].get(cid, c.get("flag_level")) if quiz and c.get("flag") else None),
            "flag": bool(c.get("flag")) and quiz,
            "pop": c.get("pop", 0),
            "areaKm2": c.get("area", 0),
            **g,
        })
    quiz_items = [c for c in countries if c["quiz"]]
    nb = neighbours(quiz_items)
    for c in countries:
        c["near"] = nb.get(c["id"], [])

    # ---- US states (Albers), with North American neighbours as background
    alb = Albers()
    usa = json.load(gzip.open(studio / "data" / "admin1" / "USA.json.gz"))
    states, us_shapes, coarse_us = [], {}, {}
    for s in usa:
        parts = project_parts(s["polys"], alb, None)
        if not parts:
            continue
        simple, g = item_geo(parts, mean_lat(s["polys"]), False)
        us_shapes[s["id"]] = svg_path(simple)
        coarse_us[s["id"]] = svg_path(coarse(parts, 0.12))
        quiz = bool(s["quiz"]) and s["id"] not in excl
        states.append({
            "id": s["id"], "name": {"en": ov["names"].get(s["id"], s["name"])}, "region": "usa", "quiz": quiz,
            "tier": ov["state_tiers"].get(s["id"], s.get("level")) if quiz else None, **g,
        })
    snb = neighbours([s for s in states if s["quiz"]])
    for s in states:
        s["near"] = snb.get(s["id"], [])
    us_bg = {}
    for c in world:
        if c["continent"] in ("North America",) and c["id"] != "US" or c["id"] in ("RU",):
            parts = project_parts(c["polys"], alb, None)
            if parts:
                b = [min(p.bounds[0] for p in parts), min(p.bounds[1] for p in parts),
                     max(p.bounds[2] for p in parts), max(p.bounds[3] for p in parts)]
                us_bg[c["id"]] = svg_path(coarse(parts, 0.06))
                coarse_us[c["id"]] = svg_path(coarse(parts, 0.2))

    dump(OUT / "countries.json", {"version": 1, "items": countries})
    dump(OUT / "us_states.json", {"version": 1, "items": states})
    dump(OUT / "world_shapes.json", {"proj": "mercator", "k": K, "wrap": round(wrap, 4), "graticule": graticule(),
                                     "shapes": shapes, "medium": medium_w, "coarse": coarse_w})
    dump(OUT / "usa_shapes.json", {"proj": "albers_usa", "k": K, "wrap": None, "shapes": us_shapes,
                                   "background": us_bg, "coarse": coarse_us})

    # ---- fonts, sounds, flags
    fonts = ROOT / "assets" / "fonts"
    fonts.mkdir(parents=True, exist_ok=True)
    for f in (studio / "assets" / "fonts").iterdir():
        shutil.copy(f, fonts / f.name)
    snd = ROOT / "assets" / "sounds"
    snd.mkdir(parents=True, exist_ok=True)
    for f in ("clock_tick.wav", "clock_tock.wav", "LICENSE.txt"):
        shutil.copy(studio / "assets" / "sounds" / f, snd / ("LICENSE-clock.txt" if f == "LICENSE.txt" else f))
    if not a.skip_flags:
        flags = ROOT / "assets" / "flags"
        flags.mkdir(parents=True, exist_ok=True)
        shutil.copy(studio / "assets" / "flags" / "LICENSE-flag-icons.txt", flags / "LICENSE-flag-icons.txt")
        ids = [c["id"] for c in countries if c["flag"]]
        subprocess.run(["node", str(HERE / "render_flags.mjs"), str(studio / "assets" / "flags"), str(flags),
                        *ids], check=True)
        # require() map for Metro (static requires only)
        lines = ["// generated by tools/build_game_data: do not edit", "export const FLAG_IMAGES: Record<string, number> = {"]
        lines += [f"  {c['id']}: require('../../assets/flags/{c['id'].lower()}.png')," for c in countries if c["flag"]]
        lines += ["};", ""]
        (ROOT / "src" / "data").mkdir(parents=True, exist_ok=True)
        (ROOT / "src" / "data" / "flagImages.ts").write_text("\n".join(lines))

    from collections import Counter
    print("countries", len(countries), "quiz", len(quiz_items), Counter(c["tier"] for c in quiz_items))
    print("states", len(states), "quiz", sum(s["quiz"] for s in states))
    for f in sorted(OUT.iterdir()):
        print(f"  {f.name:22s} {f.stat().st_size / 1024:8.0f} KB")


def dump(path: Path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
