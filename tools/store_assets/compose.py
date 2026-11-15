"""Store screenshots in the videos' style: a white title card with a caption above the game screen.

    python3 tools/store_assets/compose.py <shots_dir>   -> store/screenshots/NN-*.png (1284x2778, App Store 6.5")
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
BLACK = ROOT / "assets/fonts/Poppins-Black.ttf"
SHOTS = [
    ("f_ask0.png", "WHAT COUNTRY IS THIS?", "The map quiz from the videos"),
    ("m_daily_ask5.png", "ALL 50 US STATES", "Plus every country and flag"),
    ("combo4.png", "BUILD YOUR COMBO", "Fast answers score more"),
    ("f_r1c.png", "STARS, COINS, LEVELS", "Every round pays off"),
    ("t_journey.png", "JOURNEY THE WORLD", "11 chapters, 110 levels"),
    ("t_home_login.png", "DAILY REWARDS", "A new Daily Challenge every day"),
]
W, H = 1284, 2778


def main(src: Path):
    out = ROOT / "store/screenshots"
    out.mkdir(parents=True, exist_ok=True)
    for i, (f, title, sub) in enumerate(SHOTS, 1):
        p = src / f
        if not p.exists():
            print("missing", p)
            continue
        c = Image.new("RGB", (W, H))
        d = ImageDraw.Draw(c)
        for y in range(H):
            t = y / H
            d.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip((0x8B, 0x5C, 0xF6), (0x6D, 0x28, 0xD9))))
        # caption card
        card = [70, 110, W - 70, 520]
        sh = Image.new("RGBA", (W, H))
        ImageDraw.Draw(sh).rounded_rectangle([card[0], card[1] + 20, card[2], card[3] + 20], 70, fill=(15, 23, 42, 90))
        c.paste(sh.filter(ImageFilter.GaussianBlur(30)), (0, 0), sh.filter(ImageFilter.GaussianBlur(30)))
        d.rounded_rectangle(card, 70, fill="white")
        size = 92
        while ImageFont.truetype(str(BLACK), size).getlength(title) > card[2] - card[0] - 100:
            size -= 4
        d.text((W / 2, 260), title, font=ImageFont.truetype(str(BLACK), size), fill="#0F172A", anchor="mm")
        d.text((W / 2, 400), sub, font=ImageFont.truetype(str(BLACK), 54), fill="#7C3AED", anchor="mm")
        # phone screen
        shot = Image.open(p).convert("RGB")
        sw = 1000
        shot = shot.resize((sw, int(shot.height * sw / shot.width)), Image.LANCZOS)
        mask = Image.new("L", shot.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width, shot.height], 80, fill=255)
        frame = Image.new("RGB", (shot.width + 36, shot.height + 36), "#0F172A")
        fm = Image.new("L", frame.size, 0)
        ImageDraw.Draw(fm).rounded_rectangle([0, 0, frame.width, frame.height], 96, fill=255)
        x0, y0 = (W - frame.width) // 2, 640
        c.paste(frame, (x0, y0), fm)
        c.paste(shot, (x0 + 18, y0 + 18), mask)
        c.save(out / f"{i:02d}-{title.lower().replace(' ', '-').replace('?', '').replace(',', '')}.png")
    print("written to", out)


if __name__ == "__main__":
    main(Path(sys.argv[1]))
