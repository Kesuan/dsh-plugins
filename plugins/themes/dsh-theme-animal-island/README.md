# Animal Island theme (DSH desktop client)

A DSH bundle that dresses the desktop client in the
[animal-island-ui](https://github.com/guokaigdg/animal-island-ui) design
language — the React kit by guokaigdg, whose Vue sibling is
[animal-island-vue](https://github.com/guokaigdg/animal-island-vue).

Cream parchment surfaces, mint teal accent, chunky rounded corners, warm (never
cold-black) shadows, a yellow focus ring, and the rounded Nunito typeface. An
**Island accent** row in Settings → General recolors the accent with the eight
island app-tile colors.

The theme is **desktop-only** twice over: the bundle is installed in the
`desktop` profile, and the client half also checks for the Electron shell
(`window.dshDesktop` / `window.dshPlatform`, falling back to the `Electron`
user-agent token). A plain browser tab pointed at the same Host keeps the
built-in look.

## Layers

| Layer | Mechanism |
| --- | --- |
| Palette, type, geometry | `ctx.theme.overrideTokens` — one light/dark token layer over the active built-in scheme, so the theme follows the Light / Dark / System appearance preference |
| Nunito face, text selection, accent-row component styles | A plugin-owned stylesheet rendered from the `shell.overlay` seat; the module system claims it and removes it with the plugin |
| Accent picker | A row registered into `settings.general.item` (order 13, right after Appearance and Font size), persisted in `localStorage` |

## Palette

| Anchors | Light | Dark |
| --- | --- | --- |
| Base background | `#f8f8f0` parchment | `#1e1a14` island night |
| Raised / nested surface | `#fffdf6` / `#f6f0e0` / `#f1e9d6` | `#29241c` / `#322c22` / `#3a3327` |
| Sidebar column | `#f2ecda` | `#231f18` |
| Primary ink | `#794f27` warm brown | `#f4ead8` warm cream |
| Secondary ink | `#9f927d` | `#c0b49c` |
| Accent / links | `#0f9d90` mint (darkened for contrast) | `#3dd4c6` |
| Success / warning / error | `#5a9e1e` / `#dba90e` / `#c94444` | `#85cc45` / `#f5c31c` / `#e87878` |

Both primitive ramps (`--dsw-static-neutral-bluish-*`, `--dsw-static-neutral-*`)
and the brand ramp (`--dsw-static-deepseek-*` → mint) are re-tinted, so the
shipped alias layer re-colors surfaces, text, borders, menus, code chrome, and
file icons coherently. Alpha borders keep the shipped subtle strengths, so the
layout gains no new outlines.

Beyond colors the token layer carries:

- **Geometry** — `--dsw-radius-xs…panel` grown to the island scale (6/10/14/20/24/28
  instead of 4/8/12/16/20/28) and `--dsw-corner-shape: superellipse(1.3)` where
  the engine supports it.
- **Shadows** — the `--dsw-shadow-lv*` scale re-tinted warm from
  `rgba(61, 52, 40, …)`; island depth is a warm foot shadow, never a cold halo.
- **Focus** — `--dsw-focus-ring-color` is amber in light mode and `#ffcc00` in
  dark mode at the shipped 2px width; the island never uses a blue focus color.
- **Typography** — only the *default* text stack is overridden
  (`Nunito, Noto Sans SC, -apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei`),
  so a font chosen in Settings → More font settings still wins. The code stack
  is left untouched: tool output and code blocks stay monospace.

The terminal ANSI blue ramp (`--dsw-static-blue-*`) is intentionally not
overridden — the sidebar terminal maps ANSI colors through it.

## Accents

The Settings row shows the island app-tile palette: mint, sky, blossom, sun,
peach, grape, leaf, coral. Choosing one re-tints buttons, links, focus washes,
and the "business" state through a single re-registered token layer. The choice
persists per browser in `localStorage` (`dsh-animal-island.accent`).

## Components

The island components are re-implemented from the design system rather than
imported: a DSH client bundle resolves only the frozen platform module table and
other DSH client packages (`dsh.client.external`), so an npm React package such
as `animal-island-ui` cannot be loaded into a hand-written plugin. The accent
swatches therefore follow the library's own pixel specs — 2px warm outline,
16px tile radius, `0 4px 0` pixel-stacked foot shadow, `-1px` hover lift, `2px`
press, `:focus-visible` ring in the island yellow — with the palette values
taken from `docs/design-system/design-tokens.md` and
`docs/design-system/components/general.md` in the upstream repository.

## Files

| File | Role |
| --- | --- |
| `package.json` | Bundle manifest: bundle patch, Web client module, locale and icon exports |
| `cordis.patch.yml` | Inserts the `theme-animal-island` row |
| `index.js` | Host half (no Host behavior; the theme is client-side) |
| `client.js` | Palette tokens, accent store, Settings row, island stylesheet, desktop gate |
| `locale/en.json`, `locale/zh.json` | Plugin Manager title and description |
| `icon.svg` | Plugin Manager icon: an island tile with sun, palm, and two waves |
| `LICENSE-Nunito.txt` | SIL Open Font License 1.1 for the embedded Nunito latin subset |

## Notes

- Disabling or removing the bundle restores the built-in palette, corners,
  shadows, focus color, and font stack; the Settings row disappears with it.
- The theme never writes the user's theme preference or font settings.
- Nunito (latin subset, variable 400–900, 39 KB) is embedded as a `data:` URI so
  the face renders offline; Chinese text falls back to the library's own
  `Noto Sans SC → PingFang SC → Microsoft YaHei` chain.
