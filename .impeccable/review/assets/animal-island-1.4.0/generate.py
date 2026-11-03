#!/usr/bin/env python3
"""Generate token-level P2 evidence for Animal Island 1.4.0.

Not screenshots: these render exact palette/token values for the light accent
coverage and dark elevated-surface changes.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
SANS = "/System/Library/Fonts/Hiragino Sans GB.ttc"
CANVAS = "#f3eee3"
INK = "#332c21"
MUTED = "#6f614d"
LINE = "#d8cdb8"
DAY_BASE = "#f8f8f0"
DAY_CARD = "#fffdf6"
DAY_INK = "#794f27"
NIGHT_BASE = "#292928"
NIGHT_CARD = "#323230"
NIGHT_INK = "#e9e8e4"
ACCENTS = [
    ("mint", "#19c8b9", "#0f9d90"),
    ("sky", "#889df0", "#4e63cf"),
    ("blossom", "#f8a6b2", "#c05a7a"),
    ("sun", "#f7cd67", "#a97c17"),
    ("peach", "#e18c6f", "#bf6440"),
    ("grape", "#b77dee", "#8b53c4"),
    ("leaf", "#8ac68a", "#4f8f4f"),
    ("coral", "#fc736d", "#c4473f"),
]
OLD_BUBBLE = "#e9fbf8"
OLD_SELECTION = (25, 200, 185)
OLD_CHIP = "#d0f6f0"
OLD_ACTIVE = (121, 79, 39)

_font_cache = {}
def sans(size):
    key = (SANS, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(SANS, size)
    return _font_cache[key]

def rgb(value):
    value = value.lstrip("#")
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))

def mix(fg, bg, amount):
    f, b = rgb(fg), rgb(bg)
    return "#" + "".join(f"{round(x * amount + y * (1 - amount)):02x}" for x, y in zip(f, b))

def tint(fg, alpha, bg):
    f, b = rgb(fg), rgb(bg)
    return "#" + "".join(f"{round(x * alpha + y * (1 - alpha)):02x}" for x, y in zip(f, b))

def luminance(value):
    parts = []
    for channel in rgb(value):
        channel /= 255
        parts.append(channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4)
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722

def label(draw, xy, text, size=18, color=INK, anchor="la", bold=False):
    draw.text(xy, text, font=sans(size), fill=color, anchor=anchor,
              stroke_width=1 if bold else 0, stroke_fill=color)

def panel(draw, box, fill, outline=LINE, radius=22):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)

def footer(draw, width, height, left, right="Animal Island 1.4.0 · token-level evidence"):
    draw.line((48, height - 78, width - 48, height - 78), fill=LINE, width=2)
    label(draw, (48, height - 62), left, 15, MUTED)
    label(draw, (width - 48, height - 34), right, 14, MUTED, anchor="ra")

# ── 1. Light accent coverage ────────────────────────────────────────────────
def coverage_image():
    width, height = 1720, 1180
    image = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(image)
    label(draw, (60, 44), "Light accent coverage — before / after", 40, INK, bold=True)
    label(draw, (60, 98), "The same four consumers, fixed mint in 1.3.0 and accent-derived in 1.4.0.", 20, MUTED)
    label(draw, (60, 128), "Token-level comparison, not a rendered DSH screenshot.", 17, MUTED)

    columns = ["Message bubble", "Text selection", "Business chip", "Active wash"]
    for panel_x, title, is_before in [(60, "1.3.0 before", True), (880, "1.4.0 after", False)]:
        panel(draw, (panel_x, 180, panel_x + 780, 960), DAY_CARD)
        label(draw, (panel_x + 30, 204), title, 23, DAY_INK, bold=True)
        for index, column in enumerate(columns):
            label(draw, (panel_x + 250 + index * 124, 250), column, 13, MUTED, anchor="ma")
        for row, (name, tile, brand) in enumerate(ACCENTS):
            y = 304 + row * 78
            draw.ellipse((panel_x + 32, y + 7, panel_x + 52, y + 27), fill=tile)
            label(draw, (panel_x + 62, y + 2), name, 18, DAY_INK, bold=True)
            if is_before:
                swatches = [
                    OLD_BUBBLE,
                    tint(f"#{OLD_SELECTION[0]:02x}{OLD_SELECTION[1]:02x}{OLD_SELECTION[2]:02x}", .28, DAY_BASE),
                    OLD_CHIP,
                    tint(f"#{OLD_ACTIVE[0]:02x}{OLD_ACTIVE[1]:02x}{OLD_ACTIVE[2]:02x}", .1216, DAY_BASE),
                ]
            else:
                swatches = [
                    mix(tile, DAY_BASE, .10),
                    mix(brand, DAY_BASE, .28),
                    mix(tile, DAY_BASE, .20),
                    mix(brand, DAY_BASE, .14),
                ]
            for index, color in enumerate(swatches):
                x = panel_x + 250 + index * 124
                draw.rounded_rectangle((x, y, x + 96, y + 44), radius=13, fill=color,
                                       outline="#d8cbb6", width=1)
    footer(draw, width, height,
            "Light surfaces stay #f8f8f0; bubble 10% tile, selection 28% brand, chip 20% tile, "
            "active wash 14% brand. Before: fixed mint plus a brown active wash.")
    image.save(OUT / "accent-coverage-before-after.png")

# ── 2. Dark elevated popovers ───────────────────────────────────────────────
def popover_image():
    width, height = 1600, 980
    image = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(image)
    label(draw, (60, 44), "Dark popover elevation — before / after", 40, INK, bold=True)
    label(draw, (60, 98), "Menus, toasts and tooltips must sit above layer 3, not share layer 2.", 20, MUTED)
    label(draw, (60, 128), "Token-level comparison, not a rendered DSH screenshot.", 17, MUTED)

    for panel_x, title, popover, key, verdict in [
        (60, "1.3.0 before", "#3b3a37", "#51504b", "popover = layer 2 · looks sunken"),
        (840, "1.4.0 after", "#4d4c47", "#5d5c56", "popover above layer 3"),
    ]:
        panel(draw, (panel_x, 180, panel_x + 700, 820), NIGHT_CARD, "#4b4a45")
        label(draw, (panel_x + 28, 204), title, 23, NIGHT_INK, bold=True)
        # layer stack
        stack = [("sidebar", "#20201f", 300), ("base", "#292928", 322),
                 ("layer 1", "#323230", 344), ("layer 2", "#3b3a37", 366),
                 ("layer 3", "#44433f", 388)]
        for name, color, y in stack:
            draw.rounded_rectangle((panel_x + 30, y, panel_x + 330, y + 20), radius=6, fill=color,
                                   outline="#5a5851", width=1)
            label(draw, (panel_x + 344, y - 2), name, 13, "#bdbdb5")
        # floating popover card
        card_y = 452
        draw.rounded_rectangle((panel_x + 70, card_y, panel_x + 630, card_y + 230), radius=18,
                               fill=popover, outline="#5a5851", width=1)
        label(draw, (panel_x + 96, card_y + 24), "menu / toast / tooltip", 18, NIGHT_INK, bold=True)
        for row in range(3):
            draw.rounded_rectangle((panel_x + 96, card_y + 74 + row * 38,
                                    panel_x + 340, card_y + 96 + row * 38), radius=5,
                                   fill="#5a5952" if popover == "#4d4c47" else "#4a4944")
        draw.rounded_rectangle((panel_x + 370, card_y + 74, panel_x + 432, card_y + 96), radius=5, fill=key)
        label(draw, (panel_x + 440, card_y + 75), "keycap", 13, "#bdbdb5")
        label(draw, (panel_x + 70, card_y + 258), verdict, 18,
              "#e4c77f" if popover == "#3b3a37" else "#b0cfa0", bold=True)
        label(draw, (panel_x + 70, card_y + 290), f"popover {popover} · key {key}", 14, "#bdbdb5")
        label(draw, (panel_x + 70, card_y + 312), f"popover luminance {luminance(popover):.4f} · layer 3 {luminance('#44433f'):.4f}", 14, "#bdbdb5")
    footer(draw, width, height,
            "Layer 3 is #44433f. 1.3.0 used #3b3a37 for overlay/menu/toast/tooltip; 1.4.0 uses #4d4c47, "
            "with keycap #5d5c56.")
    image.save(OUT / "popover-before-after.png")

if __name__ == "__main__":
    coverage_image()
    popover_image()
    for path in sorted(OUT.glob("*.png")):
        print(path.name, path.stat().st_size)
