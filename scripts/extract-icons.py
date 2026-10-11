#!/usr/bin/env python3
"""Skærer ikoner ud af referencebillederne i ref/.

- App-ikon: ref/lommeregner-ikon.png (udsnit af iPhone-hjemmeskærmen, 225 px).
  De sorte hjørner fyldes med kantfarven, så iOS selv kan runde hjørnerne.
- Knap-tegn: skæres ud af ref/5.webp, ref/2.webp og ref/1.webp og gemmes som hvide
  PNG'er med gennemsigtighed i glyphs/. De bruges som CSS-masker, så farven kan skifte
  (fx orange tegn på hvid knap, når en operator er valgt).

Kør: python3 scripts/extract-icons.py   (kræver Pillow + numpy)
"""
import numpy as np
from PIL import Image

REF = 'ref/'
OUT = 'glyphs/'
SCALE = 2  # gem i dobbelt opløsning (Lanczos) for blødere skalering

# Knapcentre i referencebillederne (923 px brede): kolonner og rækker
COLS = [136.4, 353.1, 569.9, 786.6]
ROWS = [888.4, 1105.1, 1321.9, 1538.6, 1755.4]


def fill_corners(img):
    a = np.asarray(img.convert('RGB')).astype(np.float64)
    inside = a.sum(axis=2) > 24
    out = a.copy()
    # Hjørnerne udenfor ikonets runde form fyldes med farven lige inden for kanten
    h, w = inside.shape
    band = a[12:24, w // 3: 2 * w // 3].reshape(-1, 3)
    out[~inside] = np.median(band, axis=0)
    known = np.ones_like(inside)
    while not known.all():
        acc = np.zeros_like(out)
        cnt = np.zeros(known.shape)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                k = np.roll(np.roll(known, dy, 0), dx, 1)
                v = np.roll(np.roll(out, dy, 0), dx, 1)
                acc += v * k[..., None]
                cnt += k
        new = (~known) & (cnt > 0)
        out[new] = acc[new] / cnt[new][:, None]
        known |= new
    return Image.fromarray(out.clip(0, 255).astype(np.uint8))


def app_icons():
    src = fill_corners(Image.open(REF + 'lommeregner-ikon.png'))
    for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512), ('favicon-32.png', 32)]:
        src.resize((size, size), Image.LANCZOS).save('icons/' + name, optimize=True)
    # maskable: ikonet i 80 % af fladen på ikonets egen baggrundsfarve
    bg = tuple(int(c) for c in np.asarray(src)[4:12, 100:125].reshape(-1, 3).mean(0))
    m = Image.new('RGB', (512, 512), bg)
    m.paste(src.resize((440, 440), Image.LANCZOS), (36, 36))
    m.save('icons/maskable-512.png', optimize=True)


def glyph(file, cx, cy, size, name, mode='gray', lift=10):
    """Skær et kvadrat ud omkring (cx, cy) og lav alfa ud fra hvor hvid pixlen er."""
    im = Image.open(REF + file).convert('RGB')
    h = size / 2
    box = (round(cx - h), round(cy - h), round(cx + h), round(cy + h))
    a = np.asarray(im.crop(box)).astype(np.float64)
    if mode == 'orange':
        alpha = a[..., 2] / 255.0  # orange har næsten ingen blå; hvid har fuld blå
        alpha = (alpha - 0.03) / 0.97
    else:
        lum = a.min(axis=2)
        edge = np.concatenate([lum[0], lum[-1], lum[:, 0], lum[:, -1]])
        bg = np.median(edge) + lift
        alpha = (lum - bg) / (255 - bg)
    alpha = alpha.clip(0, 1)
    alpha[:3, :] = alpha[-3:, :] = 0  # fjern støj fra nabo-elementer i kanten
    alpha[:, :3] = alpha[:, -3:] = 0
    rgba = np.zeros(a.shape[:2] + (4,), np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha * 255).round().astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    out = out.resize((out.width * SCALE, out.height * SCALE), Image.LANCZOS)
    out.save(OUT + name + '.png', optimize=True)
    return size


def glyphs():
    sizes = {}
    S = 132  # knap-tegn: kvadrat på 132 px (knappen er 197 px)
    sizes['back'] = glyph('5.webp', COLS[0], ROWS[0], S, 'back')
    sizes['pct'] = glyph('5.webp', COLS[2], ROWS[0], S, 'pct')
    sizes['pm'] = glyph('5.webp', COLS[0], ROWS[4], S, 'pm')
    sizes['comma'] = glyph('5.webp', COLS[2], ROWS[4], S, 'comma')
    for op, r in [('div', 0), ('mul', 1), ('sub', 2), ('add', 3), ('eq', 4)]:
        sizes[op] = glyph('5.webp', COLS[3], ROWS[r], S, op, mode='orange')
    # Runde topknapper (Ø 102 px): kun indholdet, ikke kanten
    sizes['clock'] = glyph('5.webp', 89, 190, 72, 'clock')
    sizes['calc'] = glyph('5.webp', 833, 190, 72, 'calc')
    # Menu-ikoner fra ref/1.webp
    sizes['m-check'] = glyph('1.webp', 368, 212, 44, 'm-check', lift=6)
    sizes['m-basic'] = glyph('1.webp', 432, 212, 64, 'm-basic', lift=6)
    sizes['m-sci'] = glyph('1.webp', 432, 310, 64, 'm-sci', lift=6)
    sizes['m-notes'] = glyph('1.webp', 432, 408, 64, 'm-notes', lift=6)
    sizes['m-conv'] = glyph('1.webp', 432, 556, 64, 'm-conv', lift=6)
    print('tegn (px i 923-bredt referencebillede):', sizes)


if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    app_icons()
    glyphs()
