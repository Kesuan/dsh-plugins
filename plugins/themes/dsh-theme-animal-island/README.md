# Animal Island theme (DSH desktop client)

A DSH bundle adapting [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) to the desktop client. Version **1.2.0** preserves the parchment light palette and replaces 1.1.0's rejected all-green night with **clean warm-charcoal surfaces and restrained mint accents**. Neutral layers and gray-white text stay independent of the selected accent; pastel states and rounded details retain the island character.

Settings → General → **Island accent** offers the same eight colors. Existing accent storage, appearance, user text fonts and code/terminal fonts are preserved.

## Surface palette

| Role | Light | Dark (1.2.0) |
| --- | --- | --- |
| Sidebar | `#f2ecda` | `#20201f` |
| Reading canvas | `#f8f8f0` | `#292928` |
| Surface 1 / 2 / 3 | `#fffdf6` / `#f6f0e0` / `#f1e9d6` | `#323230` / `#3b3a37` / `#44433f` |
| Primary / strong text | `#794f27` / `#5a3a1c` | `#e9e8e4` / `#f5f4ef` |
| Dimmed / secondary text | `#8a7b66` / `#9f927d` | `#d0cfc8` / `#bdbdb5` |
| Default mint / hover | `#0f9d90` / `#12b3a6` | `#8bd5ba` / `#a4e2cc` |
| Success / warning / error | `#5a9e1e` / `#dba90e` / `#c94444` | `#b0cfa0` / `#e4c77f` / `#e5a09a` |

Dark neutral and neutral-bluish primitive ramps also use warm charcoal, including direct primitive consumers such as composer chrome. Dark selected/active backgrounds use `color-mix(in srgb, brand 18%, transparent)`; ordinary hover stays neutral (`#f5f4ef0f`). The separate accent-hover wash remains 12% brand in dark / 16% in light. Do not confuse these with the primary button's hover color.

Dark brand primitives and 24% text-selection wash follow the selected accent. Light MINT primitives and the existing light text-selection wash remain fixed. Dark menus are opaque surface 2; focus stays yellow. Dark corner tokens start at 12px, while light corner values remain intact. These night colors are a project adaptation, not an official upstream dark scheme. Source: [neutral ramps and surfaces](<client.js#L114-L247>), [token mapping and interaction formulas](<client.js#L327-L470>).

## Settings control

The picker uses 44px round color samples with an inner selection dot and a visible current color name. Samples wrap at narrow widths. Wrapped native radio inputs provide keyboard selection and accessible names; no Unicode checkmark or decorative icon library is needed. Samples have no stacked button shadow. Motion uses the upstream easing over 0.2s and respects reduced-motion preferences; forced-colors mode exposes native radios.

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

The [1.2.0 review record](<../../../.impeccable/review/animal-island-1.2.0.md>) reports **SOURCE ACCEPTED / VISUAL PENDING**. The implementation session recorded **6 passing Node tests** and **1,008 light token values across all eight accents identical to 1.1.0**. Tests cover accent/token behavior, dark foreground contrast and surface ordering, neutral surfaces across accents, desktop activation, preference fallback and resource disposal at the service boundary, without rendering React or a DOM. This documentation-only update did not rerun those checks.

The user's real desktop screenshot showed **1.1.0**, rejected for an oppressive green cast, flat hierarchy and insufficient lightness. It is failure evidence for the old version, **not visual acceptance evidence for 1.2.0**. Static checks do not certify rendered host states, syntax highlighting, focus, menu compositing or layout. The new source has no completed visual acceptance: verify the refreshed/restarted desktop UI in General settings, conversations, tool output, menus and sidebars.

## Files

- [client.js](<client.js>): theme tokens, accent store, settings radio group, stylesheet and desktop gate.
- [index.js](<index.js>): no-op Host entry; [cordis.patch.yml](<cordis.patch.yml>): existing `theme-animal-island` row.
- [package.json](<package.json>): manifest, client declaration and exports.
- [English metadata](<locale/en.json>), [Chinese metadata](<locale/zh.json>): localized display metadata.
- [icon.svg](<icon.svg>): existing original island icon, retained.
- [theme.test.js](<theme.test.js>): service-boundary regression and contrast checks.
- [Design system](<../../../DESIGN.md>), [sidecar](<../../../.impeccable/design.json>): current source-aligned design documentation.
