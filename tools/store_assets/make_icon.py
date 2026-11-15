"""App icon, adaptive icon, splash and favicon in the videos' look (sea gradient, paper land, purple target).

    python3 tools/store_assets/make_icon.py   -> assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png, assets/favicon.png
"""
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
W = json.loads((ROOT / "assets/data/world_shapes.json").read_text())
FONT = ROOT / "assets/fonts/Poppins-Black.ttf"


def rings(d):
    out = []
    for part in re.split(r"(?=M)", d):
        nums = [float(x) for x in re.findall(r"-?\d+\.?\d*", part)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 3:
            out.append(pts)
    return out


def draw_map(size, cx, cy, scale, target="IT", ids=None):
    img = Image.new("RGBA", (size, size))
    g = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        c = tuple(int(a + (b - a) * t) for a, b in zip((0xCF, 0xE6, 0xF7), (0xB4, 0xD6, 0xF2)))
        g.line([(0, y), (size, y)], fill=c + (255,))
    shadow = Image.new("RGBA", (size, size))
    land = Image.new("RGBA", (size, size))
    sd, ld = ImageDraw.Draw(shadow), ImageDraw.Draw(land)
    tp = lambda p: ((p[0] - cx) * scale + size / 2, (p[1] - cy) * scale + size / 2)
    for cid, d in W["shapes"].items():
        for r in rings(d):
            pts = [tp(p) for p in r]
            if max(abs(x - size / 2) for x, _ in pts) > size * 2:
                continue
            sd.polygon([(x, y + size * 0.012) for x, y in pts], fill=(0x9C, 0xC3, 0xE4, 255))
            if cid == target:
                continue
            ld.polygon(pts, fill=(0xFF, 0xFD, 0xF9, 255), outline=(0x8C, 0x9D, 0xB0, 255), width=max(2, size // 300))
    img.alpha_composite(shadow)
    img.alpha_composite(land)
    glow = Image.new("RGBA", (size, size))
    gd = ImageDraw.Draw(glow)
    tgt = Image.new("RGBA", (size, size))
    td = ImageDraw.Draw(tgt)
    for r in rings(W["shapes"][target]):
        pts = [tp(p) for p in r]
        gd.polygon(pts, fill=(0x7C, 0x3A, 0xED, 200))
        td.polygon(pts, fill=(0x7C, 0x3A, 0xED, 255), outline=(0x4C, 0x1D, 0x95, 255), width=max(3, size // 160))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size / 40)))
    img.alpha_composite(tgt)
    return img


def badge(img, cx, cy, r):
    d = ImageDraw.Draw(img)
    sh = Image.new("RGBA", img.size)
    ImageDraw.Draw(sh).ellipse([cx - r, cy - r + r * 0.12, cx + r, cy + r + r * 0.12], fill=(15, 23, 42, 70))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(r * 0.15)))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(255, 255, 255, 255))
    f = ImageFont.truetype(str(FONT), int(r * 1.45))
    d.text((cx, cy + r * 0.05), "?", font=f, fill=(0x7C, 0x3A, 0xED, 255), anchor="mm")


def main():
    # Italy, centred a little low; projected units from the data (K=100 per radian)
    it = rings(W["shapes"]["IT"])
    xs = [p[0] for r in it for p in r]
    ys = [p[1] for r in it for p in r]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    size = 1024
    icon = draw_map(size, cx + 1.5, cy - 3, size / 34)
    badge(icon, size * 0.73, size * 0.27, size * 0.15)
    icon.convert("RGB").save(ROOT / "assets/icon.png")
    # adaptive: content inside the central 66% safe zone
    ad = draw_map(size, cx + 1.5, cy - 2, size / 52)
    badge(ad, size * 0.64, size * 0.36, size * 0.1)
    ad.save(ROOT / "assets/adaptive-icon.png")
    # splash icon: the target country with the badge on transparent
    sp = Image.new("RGBA", (size, size))
    m = draw_map(size, cx + 1.5, cy - 3, size / 34)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([size * 0.12, size * 0.12, size * 0.88, size * 0.88], radius=size * 0.16, fill=255)
    sp.paste(m, (0, 0), mask)
    badge(sp, size * 0.73, size * 0.27, size * 0.12)
    sp.save(ROOT / "assets/splash-icon.png")
    icon.resize((48, 48), Image.LANCZOS).convert("RGB").save(ROOT / "assets/favicon.png")
    print("icons written")


if __name__ == "__main__":
    main()
