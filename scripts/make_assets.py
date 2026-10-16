#!/usr/bin/env python3
"""
make_assets.py — regenerate the raster brand assets from the source of truth.

The SVG rasteriser is not available on this host, so the icon mark is
redrawn with Pillow primitives using the exact coordinates and colours
from icon.svg. Everything is supersampled 2x (4x for the tiny favicon)
and downsampled, which is what gives the hairlines clean edges.

Fonts are converted out of the self-hosted woff2 subsets with fontTools,
so the Open Graph card is set in the real Space Grotesk / JetBrains Mono
rather than a system fallback.

  python3 scripts/make_assets.py

Outputs:
  favicon.ico                16 / 32 / 48 / 64
  apple-touch-icon.png       180x180
  assets/images/og.png       1200x630
"""

from __future__ import annotations

import math
import random
import tempfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "assets" / "fonts"

GROUND = (4, 6, 10)          # --ink-000  #04060a
HAIRLINE = (30, 39, 49)      # --border   #1e2731
ACCENT = (47, 224, 138)      # --accent   #2fe08a
INK = (238, 242, 247)        # --text     #eef2f7
MUTED = (139, 154, 171)      # --text-muted #8b9aab
FAINT = (22, 30, 38)         # panel fill / faint rules


# ── font helpers ──────────────────────────────────────────────────
def _to_ttf(woff2: Path, out: Path) -> Path:
    """decompress a woff2 subset to a plain ttf Pillow can open"""
    font = TTFont(str(woff2))
    font.flavor = None
    font.save(str(out))
    return out


def load(name: str, size: int, weight: int | None = None) -> ImageFont.FreeTypeFont:
    """load a brand font at `size`, pinning the wght axis when variable"""
    src = FONTS / name
    key = f"{src.stem}-{size}-{weight}.ttf"
    cache = Path(tempfile.gettempdir()) / f"nexus-{key}"
    if not cache.exists():
        _to_ttf(src, cache)
    font = ImageFont.truetype(str(cache), size)
    if weight is not None:
        try:
            font.set_variation_by_axes([weight])
        except Exception:
            try:
                font.set_variation_by_name("Bold" if weight >= 600 else "Regular")
            except Exception:
                pass  # static subset: keep the single instance it shipped
    return font


# ── the icon mark (mirrors icon.svg exactly) ──────────────────────
def draw_mark(size: int) -> Image.Image:
    """the AS monogram: chevron + underscore on the near-black ground"""
    s = size / 32.0
    ss = 4                       # supersample for crisp hairlines
    big = size * ss
    b = big / 32.0

    img = Image.new("RGBA", (big, big), GROUND + (255,))
    d = ImageDraw.Draw(img)

    # inner hairline frame (1.5px inset, 1px stroke in the source)
    pad = 1.5 * b
    d.rectangle(
        [pad, pad, big - pad - 1, big - pad - 1],
        outline=HAIRLINE + (255,),
        width=max(1, round(1 * b)),
    )

    stroke = max(1, round(2.4 * b))
    # chevron: M9 11.5 L14 16 L9 20.5
    chevron = [(9 * b, 11.5 * b), (14 * b, 16 * b), (9 * b, 20.5 * b)]
    d.line(chevron, fill=ACCENT + (255,), width=stroke, joint="curve")
    for x, y in chevron:          # square caps
        r = stroke / 2
        d.rectangle([x - r, y - r, x + r, y + r], fill=ACCENT + (255,))

    # underscore: M16.5 21.5 h7
    d.line(
        [(16.5 * b, 21.5 * b), (23.5 * b, 21.5 * b)],
        fill=INK + (255,),
        width=stroke,
    )
    for x, y in [(16.5 * b, 21.5 * b), (23.5 * b, 21.5 * b)]:
        r = stroke / 2
        d.rectangle([x - r, y - r, x + r, y + r], fill=INK + (255,))

    return img.resize((size, size), Image.LANCZOS)


def make_favicon() -> None:
    sizes = [16, 32, 48, 64]
    images = [draw_mark(s) for s in sizes]
    images[-1].save(
        ROOT / "favicon.ico",
        format="ICO",
        sizes=[(s, s) for s in sizes],
        append_images=images[:-1],
    )
    print(f"[assets] favicon.ico  {sizes}")


def make_apple_touch() -> None:
    # iOS masks its own corners; ship a flat square, no transparency
    mark = draw_mark(180).convert("RGBA")
    out = Image.new("RGBA", (180, 180), GROUND + (255,))
    out.alpha_composite(mark)
    out.convert("RGB").save(ROOT / "apple-touch-icon.png")
    print("[assets] apple-touch-icon.png 180x180")


# ── the Open Graph card ───────────────────────────────────────────
def outline_text(
    base: Image.Image, xy: tuple[int, int], text: str, font, color, width: int
) -> None:
    """stamp outline-only text (Pillow cannot stroke with a hollow fill)"""
    probe = ImageDraw.Draw(base)
    box = probe.textbbox((0, 0), text, font=font)
    w, h = box[2] - box[0] + width * 4, box[3] - box[1] + width * 4
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).text(
        (width * 2 - box[0], width * 2 - box[1]), text, font=font, fill=255
    )
    ring = ImageChops.subtract(mask.filter(ImageFilter.MaxFilter(width * 2 + 1)), mask)
    base.paste(Image.new("RGBA", (w, h), color + (255,)), (xy[0] - width * 2, xy[1] - width * 2), ring)


def node_field(size: tuple[int, int], seed: int = 7) -> Image.Image:
    """the hero's constellation, frozen — decorative, never the ground"""
    w, h = size
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng = random.Random(seed)

    pts = [(rng.uniform(0, w), rng.uniform(0, h)) for _ in range(46)]
    link = min(w, h) * 0.16
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            dist = math.dist(a, b)
            if dist > link:
                continue
            fade = 1 - dist / link
            alpha = int(56 * fade)
            d.line([a, b], fill=HAIRLINE + (alpha,), width=1)
    for i, (x, y) in enumerate(pts):
        r = 2 if i % 5 else 3
        d.ellipse([x - r, y - r, x + r, y + r], fill=ACCENT + (70,))
    return layer


def tracked(draw: ImageDraw.ImageDraw, xy, text, font, fill, track: int) -> int:
    """letter-spaced text; returns the x cursor after the last glyph"""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += int(draw.textlength(ch, font=font)) + track
    return x


def make_og() -> None:
    S = 2                                   # supersample
    W, H = 1200 * S, 630 * S
    img = Image.new("RGBA", (W, H), GROUND + (255,))
    img.alpha_composite(node_field((W, H)))

    # the left rail the page reserves on wide screens
    d = ImageDraw.Draw(img)
    rail = 10 * S
    d.rectangle([rail, 0, rail + 1, H], fill=HAIRLINE + (255,))

    pad = 78 * S
    h1 = load("SpaceGrotesk.woff2", 118 * S, 600)
    h1b = load("SpaceGrotesk.woff2", 118 * S, 300)
    mono = load("JetBrainsMono.woff2", 19 * S, 500)
    mono_s = load("JetBrainsMono.woff2", 16 * S, 500)

    # eyebrow
    ey = 92 * S
    d.rectangle([pad, ey + 9 * S, pad + 40 * S, ey + 10 * S], fill=ACCENT + (255,))
    tracked(
        d, (pad + 56 * S, ey), "NEXUS AUTOMATION / PORTFOLIO", mono, MUTED + (255,), 3 * S
    )

    # the name — filled first name, outlined surname, same as the hero
    d.text((pad, 148 * S), "Aleem", font=h1, fill=INK + (255,))
    outline_text(img, (pad, 262 * S), "Shahzad", h1b, (60, 74, 90), 2 * S)

    # what he does
    d.text(
        (pad, 414 * S),
        "Technical SEO  /  Python + CDP automation  /  Full-stack",
        font=load("SpaceGrotesk.woff2", 26 * S, 400),
        fill=MUTED + (255,),
    )

    # the three numbers he leads with
    d.rectangle([pad, 484 * S, W - pad, 485 * S], fill=HAIRLINE + (255,))
    x = tracked(d, (pad, 508 * S), "7+ YEARS", mono_s, INK + (255,), 2 * S)
    x = tracked(d, (x + 26 * S, 508 * S), "100+ AUTOMATION BOTS", mono_s, MUTED + (255,), 2 * S)
    tracked(d, (x + 26 * S, 508 * S), "10M+ ORGANIC REACH", mono_s, ACCENT + (255,), 2 * S)

    d.text(
        (pad, 556 * S), "aleemshahad.github.io/portfolio", font=mono_s, fill=(70, 84, 100) + (255,)
    )

    img.convert("RGB").resize((1200, 630), Image.LANCZOS).save(
        ROOT / "assets" / "images" / "og.png"
    )
    print("[assets] og.png 1200x630")


if __name__ == "__main__":
    (ROOT / "assets" / "images").mkdir(parents=True, exist_ok=True)
    make_favicon()
    make_apple_touch()
    make_og()
    print("[assets] done")
