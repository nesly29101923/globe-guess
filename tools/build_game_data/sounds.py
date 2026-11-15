"""Synthesise every game sound (no samples, no licences), except the CC0 clock tick/tock from the studio.

    python3 tools/build_game_data/sounds.py   -> assets/sounds/*.wav (22.05 kHz mono, 16-bit)
"""
from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 22050
OUT = Path(__file__).resolve().parents[2] / "assets" / "sounds"


def env(n, a=0.004, r=0.08, curve=3.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = np.exp(-curve * t / max(r, 1e-4))
    return e * rel


def tone(f, dur, kind="sine", a=0.004, r=None, vol=0.5, harm=(1.0,)):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = np.broadcast_to(np.asarray(f, dtype=float), (n,)) if np.ndim(f) else np.full(n, float(f))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if kind == "sine":
        w = sum(h * np.sin(ph * (i + 1)) for i, h in enumerate(harm))
    elif kind == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    else:
        w = np.sign(np.sin(ph)) * 0.5
    return w * env(n, a, r or dur / 2.5) * vol


def noise(dur, vol=0.3, r=None, lp=0.0):
    n = int(SR * dur)
    x = np.random.default_rng(7).uniform(-1, 1, n)
    if lp:
        y = np.zeros(n)
        acc = 0.0
        for i in range(n):
            acc += lp * (x[i] - acc)
            y[i] = acc
        x = y / (np.max(np.abs(y)) + 1e-9)
    return x * env(n, 0.01, r or dur / 3) * vol


def seq(parts, gap=0.0):
    out = []
    for p in parts:
        out.append(p)
        if gap:
            out.append(np.zeros(int(SR * gap)))
    return np.concatenate(out)


def mix(*xs):
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def at(x, delay):
    return np.concatenate([np.zeros(int(SR * delay)), x])


def write(name, x, peak=0.85):
    x = np.asarray(x, dtype=float)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * peak
    fade = min(len(x), int(SR * 0.004))
    x[-fade:] *= np.linspace(1, 0, fade)
    data = (x * 32767).astype(np.int16)
    with wave.open(str(OUT / f"{name}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def semis(f, s):
    return f * 2 ** (s / 12)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    bell = (1.0, 0.35, 0.12, 0.05)
    # UI tap: short soft click-pop
    write("tap", mix(tone(np.linspace(900, 500, int(SR * 0.05)), 0.05, r=0.012, vol=0.6), noise(0.012, 0.15, r=0.003)), 0.6)
    # answer buttons pop in
    write("pop", tone(np.linspace(420, 820, int(SR * 0.07)), 0.07, r=0.025, vol=0.6), 0.55)
    # correct: two-note rising chime; 8 versions a semitone apart for the combo
    for i in range(8):
        f = semis(659.25, i)
        x = mix(tone(f, 0.22, harm=bell, r=0.09, vol=0.5), at(tone(semis(f, 7), 0.32, harm=bell, r=0.14, vol=0.55), 0.07))
        write(f"correct_{i}", x, 0.8)
    # wrong: soft low thud
    write("wrong", mix(tone(np.linspace(220, 110, int(SR * 0.22)), 0.22, kind="tri", r=0.07, vol=0.7),
                       noise(0.06, 0.2, r=0.02, lp=0.08)), 0.7)
    # timeout: two falling soft notes
    write("timeout", seq([tone(392, 0.12, harm=bell, r=0.05, vol=0.5), tone(311, 0.2, harm=bell, r=0.08, vol=0.5)]), 0.6)
    # whoosh: filtered noise swell
    n = int(SR * 0.45)
    w = noise(0.45, 0.6, r=1.0, lp=0.05)
    w *= np.sin(np.linspace(0, np.pi, n)) ** 2
    write("whoosh", w, 0.35)
    # stars: three rising notes
    for i, s in enumerate((0, 4, 7)):
        write(f"star_{i + 1}", mix(tone(semis(783.99, s), 0.35, harm=bell, r=0.14, vol=0.6),
                                   at(tone(semis(1567.98, s), 0.2, r=0.06, vol=0.15), 0.01)), 0.8)
    # coin pickup (3 variants, pitch slightly different)
    for i, f in enumerate((1318.5, 1396.9, 1480.0)):
        write(f"coin_{i}", seq([tone(f, 0.05, harm=bell, r=0.02, vol=0.5), tone(f * 1.335, 0.12, harm=bell, r=0.05, vol=0.5)]), 0.5)
    # count-up tick
    write("count", tone(1800, 0.025, r=0.006, vol=0.4), 0.35)
    # level-up fanfare
    notes = [(523.25, 0.11), (659.25, 0.11), (783.99, 0.11), (1046.5, 0.45)]
    x = seq([mix(tone(f, d + 0.1, kind="tri", r=d, vol=0.4), tone(f * 2, d, harm=bell, r=d / 2, vol=0.2)) for f, d in notes])
    write("levelup", mix(x, at(tone(1318.5, 0.5, harm=bell, r=0.3, vol=0.25), 0.33)), 0.8)
    # chest open: thump + sparkle arpeggio
    sparkle = seq([tone(semis(1046.5, s), 0.08, harm=bell, r=0.04, vol=0.4) for s in (0, 4, 7, 12, 16)])
    write("chest", mix(tone(np.linspace(160, 80, int(SR * 0.2)), 0.2, kind="tri", r=0.06, vol=0.8), at(sparkle, 0.12)), 0.8)
    # streak flame: soft whoosh up + warm chord
    write("flame", mix(noise(0.35, 0.25, r=0.15, lp=0.1), at(mix(tone(440, 0.4, harm=bell, r=0.2, vol=0.3),
                                                               tone(554.4, 0.4, harm=bell, r=0.2, vol=0.3),
                                                               tone(659.3, 0.4, harm=bell, r=0.2, vol=0.3)), 0.08)), 0.7)
    # new atlas card: flip + bright ping
    write("card", mix(noise(0.05, 0.4, r=0.015), at(tone(2093, 0.25, harm=bell, r=0.1, vol=0.4), 0.04)), 0.6)
    # unlock: rising sweep + chord
    write("unlock", mix(tone(np.linspace(400, 1200, int(SR * 0.25)), 0.25, r=0.2, vol=0.3),
                        at(mix(tone(659.3, 0.5, harm=bell, r=0.3, vol=0.3), tone(987.8, 0.5, harm=bell, r=0.3, vol=0.3)), 0.2)), 0.75)
    # combo break: small descending blip
    write("combo_break", tone(np.linspace(600, 300, int(SR * 0.15)), 0.15, kind="tri", r=0.05, vol=0.5), 0.45)
    # power-up use
    write("powerup", seq([tone(semis(880, s), 0.06, kind="tri", r=0.03, vol=0.4) for s in (0, 5, 9, 12)]), 0.6)
    # heart lost
    write("heart", mix(tone(np.linspace(500, 250, int(SR * 0.3)), 0.3, harm=bell, r=0.1, vol=0.5)), 0.55)
    # milestone / perfect round fanfare (longer)
    x = seq([tone(semis(523.25, s), 0.09, harm=bell, r=0.05, vol=0.45) for s in (0, 4, 7, 12, 7, 12, 16)])
    write("fanfare", mix(x, at(tone(semis(523.25, 24), 0.6, harm=bell, r=0.35, vol=0.35), 0.6)), 0.8)
    # music: a very light 16-second pad loop for the menus (off by default)
    chords = [(261.63, 329.63, 392.0), (220.0, 261.63, 329.63), (174.61, 220.0, 261.63), (196.0, 246.94, 293.66)]
    bars = []
    for ch in chords:
        n = int(SR * 4)
        t = np.arange(n) / SR
        x = np.zeros(n)
        for f in ch:
            x += np.sin(2 * np.pi * f * t) * 0.18 + np.sin(2 * np.pi * f * 2 * t) * 0.04
        env_ = np.minimum(1, t / 0.8) * np.minimum(1, (4 - t) / 0.8)
        arp = np.zeros(n)
        for k in range(8):
            f = ch[k % 3] * 2
            a = int(k * SR * 0.5)
            m = int(SR * 0.45)
            tt = np.arange(m) / SR
            arp[a:a + m] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 6) * 0.08
        bars.append(x * env_ + arp)
    write("music", np.concatenate(bars), 0.35)
    print("sounds written to", OUT)


if __name__ == "__main__":
    main()
