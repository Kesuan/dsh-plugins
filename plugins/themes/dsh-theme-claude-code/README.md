# Claude Code theme (DSH Web UI)

A DSH bundle that paints the Web UI with Anthropic's Claude Code palette.

- Every token carries both a light and a dark value, so the Theme service
  re-resolves the palette whenever the active color scheme changes. With the
  appearance preference on **System**, the UI follows the OS light/dark
  appearance automatically; an explicit Light or Dark preference picks the
  matching half.
- Two layers are overridden: the shipped variable primitives that the alias
  layer references (`--dsw-static-neutral-bluish-*`, `--dsw-static-neutral-*`,
  `--dsw-static-deepseek-*`, and the semantic green/red/amber ramps), plus
  explicit alias overrides where the built-in design is flat (all light
  surfaces are white) or where a color must differ per scheme (primary action,
  states, hover washes, sidebar column, menu surfaces, thinking overlays).
- Disabling or removing the bundle restores the built-in palette.
- Typography is part of the theme too: interface text defaults to the system UI
  serif (`ui-serif`), and code/tool output defaults to the installed
  `JetBrainsMono NFM` (see [Typography](#typography)).

## Palette

| Anchor | Light | Dark |
| --- | --- | --- |
| Base background | `#faf9f5` warm paper | `#191817` warm charcoal |
| Raised / nested surface | `#ffffff` / `#f4f2ec` / `#eeeadf` | `#22211e` / `#2a2824` / `#312f2a` |
| Sidebar | `#f0eee6` | `#1f1e1b` |
| Brand / primary action | `#c05a32` (clay, darkened for light contrast) | `#d97757` (Claude clay) |
| Primary text | `#141413` | `#faf9f5` |
| Secondary text | `#6a645a` | `#d2ccbe` |
| Success / warning / error | `#2c7a39` / `#966c1e` / `#ab2b3f` | `#4eba65` / `#ffc107` / `#ff6b80` |

Claude Code's own theme values are used where they translate
(`claude: rgb(215,119,87)` and the terminal success/warn/error palette);
surfaces, text, and borders use Anthropic's warm paper and charcoal tones.
Neutral alpha borders keep the shipped subtle strengths so the layout does not
gain new outlines.

The terminal ANSI blue ramp (`--dsw-static-blue-*`) is intentionally left
untouched: the shell maps ANSI cyan/bright colors through it, and recoloring it
would corrupt terminal output.

## Typography

The bundle overrides only the **default** font stacks, so a font chosen in
Settings → More font settings still wins:

- interface text: `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`
  (Chromium's system UI serif — New York on macOS);
- code, inline code, tool output: `"JetBrainsMono NFM"` first, then the shipped
  SF Mono / JetBrains Mono / Fira Code fallbacks. The shipped stack asks for
  `"JetBrains Mono"`, which does not match the installed Nerd Font family names
  (`JetBrainsMono NFM`), so it previously fell through to Menlo.

The sidebar terminal is not covered: it is an xterm instance fed from the saved
terminal font setting (`theme.fontFamilies.terminal`), not from a CSS token, so
a plugin cannot set it without overwriting the user's preference. Set it once in
Settings → More font settings → Terminal font: `JetBrainsMono NFM`.

## Files

| File | Role |
| --- | --- |
| `package.json` | Bundle manifest: bundle patch, Web client module, locale and icon exports |
| `cordis.patch.yml` | Inserts the `theme-claude-code` row |
| `index.js` | Host half (no Host behavior; the palette is client-side) |
| `client.js` | Registers the light/dark token layer through `ctx.theme.overrideTokens` |
| `locale/en.json`, `locale/zh.json` | Plugin Manager title and description |
| `icon.svg` | Plugin Manager icon (half paper / half charcoal tile with a clay prompt) |

## Notes

- The layer applies whenever the plugin is enabled, over whichever built-in
  scheme is active; it does not write the user's theme preference or font
  settings.
- Token values are CSS values, not just colors: the thinking-overlay gradients
  are overridden as gradients and the menu fill keeps its shipped translucency.
