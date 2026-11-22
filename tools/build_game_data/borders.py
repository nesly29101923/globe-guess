"""Land borders and safe wrong answers, computed from the game's own map outlines.

Writes assets/data/borders.json:
  { "world": { id: { "borders": [...], "far": [...] } }, "usa": {...} }
- borders: places sharing a land border of at least MIN_SHARED_KM with this one.
- far: nearby places (by distance) whose outline is at least MIN_GAP_KM away: safe wrong answers for a
  "Which one borders X?" question, so a corner touch or a narrow strait can never make a "wrong" answer arguable.

Outlines are simplified per place, so shared borders do not coincide exactly: a border is where one outline runs
within TOUCH_KM of the other. Run: python3 tools/build_game_data/borders.py (needs shapely).
"""
import json
import re
from pathlib import Path

from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "assets" / "data"
TOUCH_KM = 3.0
MIN_SHARED_KM = 15.0
MIN_GAP_KM = 80.0
NEAREST = 40

# Pairs that are arguable (a disputed territory between them, a claimed border, or a border only across a lake):
# never asked as a border and never offered as a wrong answer.
NEVER = {
    frozenset(p) for p in [
        ("RS", "AL"), ("RS", "MK"), ("RS", "ME"),  # Kosovo
        ("MA", "MR"),                              # Western Sahara
        ("SO", "DJ"),                              # Somaliland
        ("IN", "AF"),                              # claimed through Kashmir
        ("SG", "MY"),                              # a strait and a causeway, no land border
        ("US-MI", "US-IL"), ("US-MI", "US-MN"),    # across Lake Michigan / Superior
    ]
}
# Never the subject or an option of a border question (borders disputed internationally).
LEAVE_OUT = {"IL"}


def parse(d: str):
    polys = []
    for ring in re.findall(r"M([^Z]*)Z", d):
        nums = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", ring)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 3:
            p = Polygon(pts)
            if not p.is_valid:
                p = p.buffer(0)
            if not p.is_empty:
                polys.append(p)
    # rings are outer shells and holes in one list: even-odd, like the game draws them
    geom = None
    for p in polys:
        geom = p if geom is None else geom.symmetric_difference(p)
    return geom if geom is not None else MultiPolygon()


def compute(items, shapes):
    geo = {}
    for it in items:
        d = shapes.get(it["id"])
        if d:
            geo[it["id"]] = parse(d)
    by = {it["id"]: it for it in items}
    quiz = [it for it in items if it.get("quiz") and it["id"] in geo]
    out = {}
    for it in quiz:
        a = geo[it["id"]]
        cx, cy = it["label"]
        others = sorted((o for o in items if o["id"] != it["id"] and o["id"] in geo),
                        key=lambda o: (o["label"][0] - cx) ** 2 + (o["label"][1] - cy) ** 2)[:NEAREST]
        borders, far = [], []
        if it["id"] in LEAVE_OUT:
            continue
        for o in others:
            if not o.get("quiz") or o["id"] in LEAVE_OUT or frozenset((it["id"], o["id"])) in NEVER:
                continue
            b = geo[o["id"]]
            kmu = (it["kmu"] + by[o["id"]]["kmu"]) / 2  # km per map unit around the two
            gap_km = a.distance(b) * kmu
            if gap_km <= TOUCH_KM:
                shared = a.boundary.intersection(b.buffer(TOUCH_KM / kmu)).length * kmu
                if shared >= MIN_SHARED_KM:
                    borders.append(o["id"])
                continue
            if gap_km >= MIN_GAP_KM:
                far.append(o["id"])
        out[it["id"]] = {"borders": borders, "far": far}
    return out


def main():
    world = json.loads((DATA / "world_shapes.json").read_text())
    usa = json.loads((DATA / "usa_shapes.json").read_text())
    countries = json.loads((DATA / "countries.json").read_text())["items"]
    states = json.loads((DATA / "us_states.json").read_text())["items"]
    res = {"world": compute(countries, world["shapes"]), "usa": compute(states, usa["shapes"])}
    (DATA / "borders.json").write_text(json.dumps(res, separators=(",", ":")))
    for k, v in res.items():
        n = sum(1 for x in v.values() if x["borders"])
        print(k, len(v), "places,", n, "with land borders")


if __name__ == "__main__":
    main()
