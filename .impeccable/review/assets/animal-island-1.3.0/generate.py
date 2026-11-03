#!/usr/bin/env python3
"""Generate token-level before/after evidence for Animal Island 1.3.0.

These are not screenshots of the DSH desktop UI. They render the exact color
values and contrast ratios from client.js (1.2.0 vs 1.3.0) so the P0/P1
changes can be compared without a browser-control tool.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
SANS = "/System/Library/Fonts/Hiragino Sans GB.ttc"
MONO = "/System/Library/Fonts/SFNSMono.ttf"
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
DAY_TILES = ["#19c8b9", "#889df0", "#f8a6b2", "#f7cd67", "#e18c6f", "#b77dee", "#8ac68a", "#fc736d"]

# 1.2.0 values
OLD_TOOLBAR = {"light": {"default": "#5a4a3373", "hover": "#5a4a3399"},
               "dark": {"default": "#bdbdb5", "hover": "#e9e8e4"}}
OLD_FOCUS = "#e0a800"
OLD_SETTINGS = {"current": "#8a7b66", "hint": "#9f927d"}

# 1.3.0 values
NEW_TOOLBAR = {"light": {"default": "#794f2714", "hover": "#794f271f"},
               "dark": {"default": "#f5f4ef14", "hover": "#f5f4ef24"}}
NEW_FOCUS = "#9a6f00"
NEW_SETTINGS = {"current": "#6f614d", "hint": "#7c6d58"}

OLD_SHIKI = {
    "light": {"constant": "#1c7ed6", "string": "#2f9e44", "comment": "#868e96",
              "keyword": "#d6336c", "parameter": "#e8590c", "function": "#6741d9",
              "string-expression": "#2b8a3e", "punctuation": "#495057", "link": "#1971c2"},
    "dark": {"constant": "#4dabf7", "string": "#69db7c", "comment": "#adb5bd",
             "keyword": "#faa2c1", "parameter": "#ffa94d", "function": "#b197fc",
             "string-expression": "#8ce99a", "punctuation": "#ced4da", "link": "#74c0fc"},
}
NEW_SHIKI = {
    "light": {"constant": "#3f55b5", "string": "#3f753f", "comment": "#7c6d58",
              "keyword": "#b03e55", "parameter": "#a85432", "function": "#7d45b5",
              "string-expression": "#356b35", "punctuation": "#665946", "link": "#0b7f75"},
    "dark": {"constant": "#adbdf0", "string": "#b0cfa0", "comment": "#a7a79e",
             "keyword": "#e5a09a", "parameter": "#e2ad91", "function": "#c5b0e4",
             "string-expression": "#c5dfb8", "punctuation": "#bdbdb5", "link": "#8bd5ba"},
}

_font_cache = {}
def sans(size):
    key = (SANS, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(SANS, size)
    return _font_cache[key]

def mono(size):
    key = (MONO, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(MONO, size)
    return _font_cache[key]

def rgb(value):
    value = value.lstrip("#")
    if len(value) == 8:
        value = value[:6]
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))

def alpha(value):
    value = value.lstrip("#")
    return int(value[6:8], 16) / 255 if len(value) == 8 else 1

def composite(fg, bg):
    f, b, a = rgb(fg), rgb(bg), alpha(fg)
    return "#" + "".join(f"{round(x * a + y * (1 - a)):02x}" for x, y in zip(f, b))

def mix(fg, bg, amount):
    f, b = rgb(fg), rgb(bg)
    return "#" + "".join(f"{round(x * amount + y * (1 - amount)):02x}" for x, y in zip(f, b))

def luminance(value):
    parts = []
    for channel in rgb(value):
        channel /= 255
        parts.append(channel / 12.92 if channel <= .04045 else ((channel + .055) / 1.055) ** 2.4)
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722

def contrast(a, b):
    x, y = sorted((luminance(a), luminance(b)), reverse=True)
    return (x + .05) / (y + .05)

def ratio_text(value):
    return f"{value:.2f}:1"

def color_for_ratio(value):
    return "#2f7d4f" if value >= 4.5 else "#b23a34"

def panel(draw, box, fill, outline=LINE, radius=22):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)

def label(draw, xy, text, size=18, color=INK, anchor="la", bold=False):
    draw.text(xy, text, font=sans(size), fill=color, anchor=anchor, stroke_width=1 if bold else 0,
              stroke_fill=color)

def footer(draw, width, height, note):
    draw.line((48, height - 78, width - 48, height - 78), fill=LINE, width=2)
    label(draw, (48, height - 62), note, 15, MUTED)
    label(draw, (width - 48, height - 34), "Animal Island 1.3.0 · token-level evidence", 14,
          MUTED, anchor="ra")

# ── 1. Toolbar fill ────────────────────────────────────────────────────────
def toolbar_image():
    width, height = 1600, 1000
    image = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(image)
    label(draw, (60, 44), "Toolbar fills — before / after", 40, INK, bold=True)
    label(draw, (60, 98), "1.2.0 wrote the fill as an opaque text colour; 1.3.0 restores a translucent background.", 20, MUTED)
    label(draw, (60, 128), "Token-level comparison, not a rendered DSH screenshot.", 17, MUTED)

    panels = [
        (60, 180, 700, 340, "light", "1.2.0 before", OLD_TOOLBAR["light"], DAY_BASE),
        (840, 180, 700, 340, "light", "1.3.0 after", NEW_TOOLBAR["light"], DAY_BASE),
        (60, 560, 700, 340, "dark", "1.2.0 before", OLD_TOOLBAR["dark"], NIGHT_BASE),
        (840, 560, 700, 340, "dark", "1.3.0 after", NEW_TOOLBAR["dark"], NIGHT_BASE),
    ]
    for x, y, w, h, scheme, title, values, bg in panels:
        is_dark = scheme == "dark"
        ink = NIGHT_INK if is_dark else DAY_INK
        panel_fill = NIGHT_CARD if is_dark else DAY_CARD
        panel(draw, (x, y, x + w, y + h), panel_fill, "#4b4a45" if is_dark else LINE)
        label(draw, (x + 28, y + 22), title, 22, ink, bold=True)
        label(draw, (x + 28, y + 52), "浅色基础面" if not is_dark else "深色基础面", 15,
              "#bdbdb5" if is_dark else MUTED)
        for index, state in enumerate(("default", "hover")):
            row_y = y + 94 + index * 112
            fill = values[state] if alpha(values[state]) == 1 else composite(values[state], bg)
            draw.rounded_rectangle((x + 32, row_y, x + 340, row_y + 66), radius=17, fill=fill,
                                   outline="#5a5851" if is_dark else "#cbbda7", width=1)
            draw.text((x + 186, row_y + 33), "Aa", font=sans(28), fill=ink, anchor="mm")
            label(draw, (x + 370, row_y + 3), state, 16, ink if is_dark else MUTED, bold=True)
            label(draw, (x + 370, row_y + 28), f"fill {values[state]}", 15, "#bdbdb5" if is_dark else MUTED)
            ratio = contrast(ink, fill)
            label(draw, (x + 370, row_y + 48), f"text contrast {ratio_text(ratio)}", 15,
                  color_for_ratio(ratio), bold=True)
    footer(draw, width, height,
            "Fill token is a background; the toolbar label stays --dsw-alias-label-primary. "
            "Dark 1.2.0 hover was 1.00:1; new fills are 4–14% neutral washes.")
    image.save(OUT / "toolbar-before-after.png")

# ── 2. Shiki syntax ────────────────────────────────────────────────────────
def syntax_image():
    width, height = 1700, 1100
    image = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(image)
    label(draw, (60, 44), "Code syntax — before / after", 40, INK, bold=True)
    label(draw, (60, 98), "Host Shiki defaults vs the island token palette, on the real code-block surfaces.", 20, MUTED)
    label(draw, (60, 128), "Token-level comparison, not a rendered DSH screenshot.", 17, MUTED)

    panels = [
        (60, 190, "light", "1.2.0 before", OLD_SHIKI["light"], DAY_BASE),
        (860, 190, "light", "1.3.0 after", NEW_SHIKI["light"], DAY_BASE),
        (60, 610, "dark", "1.2.0 before", OLD_SHIKI["dark"], NIGHT_BASE),
        (860, 610, "dark", "1.3.0 after", NEW_SHIKI["dark"], NIGHT_BASE),
    ]
    code = [
        [("const", "keyword"), (" ", "plain"), ("island", "plain"), (" = ", "punctuation"),
         ("greet", "function"), ("(", "punctuation"), ('"mint"', "string"), (", ", "punctuation"),
         ("42", "constant"), (");", "punctuation")],
        [("type", "keyword"), (" ", "plain"), ("Island", "plain"), (" = { ", "punctuation"),
         ("accent", "parameter"), (": ", "punctuation"), ("string", "constant"), (" };", "punctuation")],
        [("// warm charcoal, a little mint", "comment")],
    ]
    for x, y, scheme, title, palette, bg in panels:
        is_dark = scheme == "dark"
        ink = NIGHT_INK if is_dark else DAY_INK
        code_bg = NIGHT_CARD if is_dark else "#fdfcf6"
        panel(draw, (x, y, x + 780, y + 380), code_bg, "#4b4a45" if is_dark else LINE)
        label(draw, (x + 28, y + 20), title, 22, ink, bold=True)
        label(draw, (x + 28, y + 50), "浅色代码块" if not is_dark else "深色代码块", 15,
              "#bdbdb5" if is_dark else MUTED)
        body_font = mono(22)
        cursor_y = y + 92
        for line in code:
            cursor_x = x + 38
            for text, style in line:
                color = ink if style == "plain" else palette.get(style, ink)
                draw.text((cursor_x, cursor_y), text, font=body_font, fill=color)
                cursor_x += draw.textlength(text, font=body_font)
            cursor_y += 42
        checks = [contrast(palette[name], code_bg) for name in OLD_SHIKI["light"]]
        minimum = min(checks)
        failing = sum(1 for value in checks if value < 4.5)
        label(draw, (x + 28, y + 330), f"min token contrast {ratio_text(minimum)} · "
              f"{failing}/9 below 4.5:1", 16, color_for_ratio(minimum), bold=True)
    footer(draw, width, height,
            "Light default Shiki fails comment/string/parameter/constant/string-expression/keyword; "
            "the island palette clears 4.5:1 for all nine. Background values are host code-block tokens.")
    image.save(OUT / "syntax-before-after.png")

# ── 3. Settings row / focus ────────────────────────────────────────────────
def settings_image():
    width, height = 1500, 900
    image = Image.new("RGB", (width, height), CANVAS)
    draw = ImageDraw.Draw(image)
    label(draw, (60, 44), "Light settings row — before / after", 40, INK, bold=True)
    label(draw, (60, 98), "Current name, hint and focus ring on the same parchment row.", 20, MUTED)
    label(draw, (60, 128), "Token-level comparison, not a rendered DSH screenshot.", 17, MUTED)

    hint_before = "A little island color for buttons, links, and selection. The reading surface stays neutral in dark mode."
    panels = [
        (60, 190, "1.2.0 before", OLD_SETTINGS, OLD_FOCUS),
        (780, 190, "1.3.0 after", NEW_SETTINGS, NEW_FOCUS),
    ]
    for x, y, title, colors, focus in panels:
        panel(draw, (x, y, x + 660, y + 560), DAY_BASE)
        label(draw, (x + 36, y + 26), title, 22, DAY_INK, bold=True)
        label(draw, (x + 36, y + 78), "Island accent", 26, DAY_INK, bold=True)
        draw.text((x + 624, y + 84), "Mint teal", font=sans(18), fill=colors["current"], anchor="ra")
        # wrap the hint to the card width
        words = hint_before.split()
        lines, line = [], ""
        for word in words:
            candidate = f"{line} {word}".strip()
            if draw.textlength(candidate, font=sans(16)) > 560:
                lines.append(line)
                line = word
            else:
                line = candidate
        if line:
            lines.append(line)
        for index, text in enumerate(lines):
            draw.text((x + 36, y + 128 + index * 25), text, font=sans(16), fill=colors["hint"])
        # eight swatches; selected first
        for index, tile in enumerate(DAY_TILES):
            cx = x + 36 + index * 58
            cy = y + 250
            fill = mix(tile, DAY_BASE, .82)
            draw.ellipse((cx, cy, cx + 44, cy + 44), fill=fill)
            if index == 0:
                draw.ellipse((cx, cy, cx + 44, cy + 44), outline=DAY_INK, width=3)
                draw.ellipse((cx + 17, cy + 17, cx + 27, cy + 27), fill=DAY_BASE,
                             outline=DAY_INK, width=2)
        # focus ring on the first swatch
        fx, fy = x + 30, y + 244
        draw.rounded_rectangle((fx, fy, fx + 56, fy + 56), radius=28, outline=focus, width=3)
        label(draw, (x + 36, y + 306), "focus ring", 14, colors["hint"])
        # metrics
        rows = [
            ("current name", colors["current"], contrast(colors["current"], DAY_BASE)),
            ("hint", colors["hint"], contrast(colors["hint"], DAY_BASE)),
            ("focus on base", focus, contrast(focus, DAY_BASE)),
        ]
        for index, (name, value, ratio) in enumerate(rows):
            row_y = y + 376 + index * 44
            label(draw, (x + 36, row_y), name, 16, DAY_INK)
            label(draw, (x + 190, row_y), value, 14, colors["hint"])
            passed = "#2f7d4f" if ratio >= (3 if name.startswith("focus") else 4.5) else "#b23a34"
            label(draw, (x + 360, row_y), ratio_text(ratio), 16, passed, bold=True)
    footer(draw, width, height,
            "Same parchment surface; only plugin-owned ink and the focus ring change. "
            "Light current 3.85→5.63, hint 2.86→4.70, focus 2.01→4.23 on base.")
    image.save(OUT / "settings-before-after.png")

if __name__ == "__main__":
    toolbar_image()
    syntax_image()
    settings_image()
    for path in sorted(OUT.glob("*.png")):
        print(path.name, path.stat().st_size)
