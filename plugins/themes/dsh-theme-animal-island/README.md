# Animal Island theme (DSH desktop client)

A DSH bundle adapting [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) to the desktop client. Version **1.5.0** adds selectable contours; **1.4.0** keeps 1.2.0's parchment day and **clean warm-charcoal night**, makes the selected accent reach light bubbles, selection, business chips, sidebar selection and info surfaces, and raises dark menus/popovers above layer 3. It also keeps 1.3.0's toolbar fill repair, island Shiki palette and settings-row readability work. Neutral layers and gray-white text stay independent of the selected accent; pastel states and rounded details retain the island character.

Settings → General → **Island accent** offers the same eight colors and three contour styles: Classic (the existing default), Subtle and Rounded. Contours adjust the host's radius tokens where consumed; they do not replace host controls. The separate `dsh-animal-island.shape` preference persists the selection and falls back to Classic when unavailable or invalid. Existing accent storage, appearance, user text fonts and code/terminal fonts are preserved.

## Surface palette

| Role | Light | Dark (1.4.0) |
| --- | --- | --- |
| Sidebar | `#f2ecda` | `#20201f` |
| Reading canvas | `#f8f8f0` | `#292928` |
| Surface 1 / 2 / 3 | `#fffdf6` / `#f6f0e0` / `#f1e9d6` | `#323230` / `#3b3a37` / `#44433f` |
| Primary / strong text | `#794f27` / `#5a3a1c` | `#e9e8e4` / `#f5f4ef` |
| Dimmed / secondary text | `#8a7b66` / `#9f927d` | `#d0cfc8` / `#bdbdb5` |
| Default mint / hover | `#0f9d90` / `#12b3a6` | `#8bd5ba` / `#a4e2cc` |
| Success / warning / error | `#5a9e1e` / `#dba90e` / `#c94444` | `#b0cfa0` / `#e4c77f` / `#ecb0aa` |

Dark neutral and neutral-bluish primitive ramps also use warm charcoal, including direct primitive consumers such as composer chrome. Dark selected/active backgrounds use `color-mix(in srgb, brand 18%, transparent)`; ordinary hover stays neutral (`#f5f4ef0f`). The separate accent-hover wash remains 12% brand in dark / 16% in light. Do not confuse these with the primary button's hover color.

Both light and dark brand primitives follow the selected accent, including the light static-deepseek ramp, text-selection wash, active wash and sidebar selection. Neutral surfaces and ordinary hover remain fixed. Dark menus, overlay, toast and tooltip use elevated `#4d4c47` above layer 3; focus stays yellow. Dark corner tokens start at 12px, while light corner values remain intact. These night colors are a project adaptation, not an official upstream dark scheme. Source: [neutral ramps and surfaces](<client.js#L73-L240>), [token mapping and interaction formulas](<client.js#L393-L554>).

## 1.3.0 changes

- **Toolbar fills are backgrounds again.** 1.2.0's dark fill/hover were opaque labels (`#bdbdb5` / `#e9e8e4`), giving only 1.54:1 and 1.00:1 against the toolbar ink; light hover was 2.25:1. The three fills are now 4–14% neutral washes in both schemes, keeping every state at 5.55:1 or better.
- **Island syntax palette.** Nine `--shiki-token-*` overrides replace Shiki's default blue/green/pink ramp. All nine clear 4.5:1 on the code-block surfaces; six of the nine default light tokens were below 4.5:1 before.
- **Running shimmer follows the accent.** `--dsw-alias-label-deep-diving-shimmer` is now a brand/label mix, so the running-label sweep no longer falls back to host static blue.
- **Settings row and focus.** Plugin-owned `--aia-current` / `--aia-hint` ink lifts the light current name from 3.85:1 to 5.63:1 and the hint from 2.86:1 to 4.70:1. The light focus ring moves from `#e0a800` to `#9a6f00`, raising it from 2.01:1 to 4.23:1 on the base surface.
- The token layer grows from 126 to 138 tokens. Surface values, accent IDs/storage, light accent values and user font precedence are unchanged.

## 1.4.0 changes

- **Eight accents now cover light surfaces too.** The light `--dsw-static-deepseek-*` ramp is derived from the selected accent: 10/20/38/58/78/100% tile tints for stops 50–450, brand at 500, and darker brand stops above that. Light message bubbles, bubble highlight, business chips, sidebar badges, info fills, file-type accents and the running label now change with the accent instead of staying mint.
- **Selection and active states follow the accent.** Light text selection uses 28% brand, the active wash 14% brand, and the selected sidebar cell 12% brand. Ordinary hover remains neutral.
- **Dark popovers are elevated.** `--dsw-alias-bg-overlay`, menu surface, toast and tooltip use `#4d4c47`, above layer 3 (`#44433f`); tooltip keys use `#5d5c56`. The dark error ink is `#ecb0aa`, and peach/grape/coral dark brands are slightly raised so accent text still clears 4.5:1 on the elevated surface.
- Token layer: 138 → 140. Light surfaces, accent IDs/storage and light brand values are unchanged.

P2 token-level images: [light accent coverage](<../../../.impeccable/review/assets/animal-island-1.4.0/accent-coverage-before-after.png>), [dark popover elevation](<../../../.impeccable/review/assets/animal-island-1.4.0/popover-before-after.png>). These are generated color comparisons, not rendered UI screenshots.

Token-level comparison images for 1.3.0: [toolbar](<../../../.impeccable/review/assets/animal-island-1.3.0/toolbar-before-after.png>), [syntax](<../../../.impeccable/review/assets/animal-island-1.3.0/syntax-before-after.png>), [settings](<../../../.impeccable/review/assets/animal-island-1.3.0/settings-before-after.png>). These are generated color/token comparisons, not screenshots of the rendered desktop UI.

## Settings control

The picker uses 44px round color samples with an inner selection dot and a visible current color name. Samples wrap at narrow widths. Wrapped native radio inputs provide keyboard selection and accessible names; no Unicode checkmark or decorative icon library is needed. Samples have no stacked button shadow. Motion uses the upstream easing over 0.2s and respects reduced-motion preferences; forced-colors mode exposes native radios. The light focus ring is intentionally deeper gold so it stays visible on parchment and layer surfaces.

## Runtime and scope

- `ctx.theme.overrideTokens` registers paired light/dark tokens without changing saved appearance. `system` continues to follow the OS.
- The plugin styles only its own settings row and global text selection, plus the embedded Nunito face. It does not read or override other plugins' DOM or replace host layout/controls.
- The settings row uses `settings.general.item`; the stylesheet carrier uses `shell.overlay`. Disabling the plugin removes both and disposes the token layer, without deleting saved preferences.
- The Electron gate (`window.dshDesktop`, `window.dshPlatform`, or Electron user agent) remains. A plain browser connected to the same Host keeps the built-in theme.
- The accent key remains `dsh-animal-island.accent`; values are mint, sky, blossom, sun, peach, grape, leaf and coral. Unavailable/invalid storage falls back to mint.
- Only the default text stack is overridden: Nunito, Noto Sans SC, system Chinese fallbacks. The bundled Nunito Latin variable subset works offline; Noto Sans SC must be installed or system Chinese fallbacks are used. See [Nunito license](<LICENSE-Nunito.txt>).

The DSH dynamic client module table supplies React. This plugin follows DSH's token/slot contract instead of importing an independent upstream application, stylesheet or controls. Palettes, typography, motion, focus and restrained depth guide the adaptation; application-only import/prop rules do not map directly to this theme adapter.

## Install / update

Install the local directory through DSH's plugin manager in the intended profile. This repository uses a local link. Source changes do not guarantee hot reload: replacing an installed bundle may require restarting DSH to load fresh JavaScript, then reopening the desktop interface. Do not start another web server to update the existing GUI.

## Validation

```powershell
node --check client.js
node --check index.js
node --test theme.test.js
```

The [1.4.0 review record](<../../../.impeccable/review/animal-island-1.4.0.md>) records **11 passing Node tests** and **140 tokens**. Tests cover accent/token behavior, dark foreground contrast and surface ordering, neutral surfaces across accents, toolbar fill semantics and alpha readability, light accent propagation, elevated dark popovers, focus/settings ink contrast, Shiki token contrast, desktop activation, preference fallback and resource disposal at the service boundary, without rendering React or a DOM. The [1.3.0 record](<../../../.impeccable/review/animal-island-1.3.0.md>) and [1.2.0 record](<../../../.impeccable/review/animal-island-1.2.0.md>) remain historical.

The user's real desktop screenshot showed **1.1.0**, rejected for an oppressive green cast, flat hierarchy and insufficient lightness. It is failure evidence for the old version, **not visual acceptance evidence for 1.4.0**. Static checks do not certify rendered host states, syntax highlighting, focus, menu compositing or layout. Live Theme inspection now lists the 1.4.0 tokens with the settings slot active, but the visible window was not captured for the repository and the comparison images are token-level renderings. Actual rendered states still need a user-side visual check in General settings, conversations, tool output, menus and sidebars.

## Files

- [client.js](<client.js>): theme tokens, accent store, settings radio group, stylesheet and desktop gate.
- [index.js](<index.js>): no-op Host entry; [cordis.patch.yml](<cordis.patch.yml>): existing `theme-animal-island` row.
- [package.json](<package.json>): manifest, client declaration and exports.
- [English metadata](<locale/en.json>), [Chinese metadata](<locale/zh.json>): localized display metadata.
- [icon.svg](<icon.svg>): existing original island icon, retained.
- [theme.test.js](<theme.test.js>): service-boundary regression and contrast checks.
- [Design system](<../../../DESIGN.md>), [sidecar](<../../../.impeccable/design.json>): current source-aligned design documentation.
