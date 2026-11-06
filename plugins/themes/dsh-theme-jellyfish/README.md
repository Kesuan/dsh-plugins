# Jellyfish theme / 水母主题

A DSH desktop theme built on the [Animal Island](<../dsh-theme-animal-island/README.md>) palette, with a dotted kraft-paper desk, a monochrome jellyfish brand mark, and a two-script type system (Baloo 2 + 思源黑体 for the interface, Space Mono + 思源宋体 for code). It replaces the shipped sidebar brand with **jellyfish HARNESS** and keeps the eight accents, three contour styles and user font precedence.

## What the theme owns

- **Palette.** Warm kraft paper by day, neutral warm charcoal by night; the eight island accents paint buttons, links and selection. Light and dark surfaces are independent of the accent.
- **Desk skin.** A dotted notebook ground on the app frame, a dashed kraft-folder sidebar edge, a paper composer card with a 2px ink rim and letterpress foot, and a ruled header. Rules match host CSS-module suffixes (`_frame`, `_centerCol`, `_rightbarCol`, `_sidebarCol`, `_composerSeat`, `_header`), verified against DSH `0.2.1-rc.5`; a future host rehash drops the skin instead of breaking layout.
  - Header and root rules are additionally qualified by element (`header[class$='_header']`) and by structure (`[class$='_root']:has(> header[class$='_header'])`). A bare suffix also matches content spans — the question-reply header is a `<span>` in a grid `<dt>`, where a forced background painted a full-width band across the answer card — and content roots such as the turn-trigger block.
- **Brand slots.** `sidebar.brand.mark` renders a monochrome jellyfish (artwork from [naive-icons](https://github.com/guokaigdg/naive-icons), MIT, flattened to `currentColor`); `sidebar.brand.name` renders `jellyfish` plus a `HARNESS` badge; `conversation.hero.brand.mark` reuses the same jellyfish on the blank-session hero, forwarding the host's `size` and geometry class. The sidebar pair registers at `priority: -1` to shadow the shipped occupants and the hero seat is empty by default, so disposing the plugin restores the official mark and wordmark without touching host config.
- **Settings.** One row in General: eight accent swatches, three contour styles (native radios), and a font-status line that reports whether the two Chinese fallbacks are installed.
- **Typography.** Two paired stacks, both as *default* tokens so a font picked in **Settings → Appearance → Font** still wins:
  - interface: `"Baloo 2", "Noto Sans SC", …`
  - code: `"Space Mono", "Noto Serif SC", …`

  Baloo 2 and Space Mono are Latin-only subsets embedded as base64, so they render on any machine. The Chinese half is deliberately a **local** font: CJK faces are 10–14 MB each, too heavy to inline. `fonts/` carries the two TTFs; the settings row shows 已安装 / 未安装 for each and names the file to install.

Layout, sizing, hit targets and behaviour stay host-owned. The theme never reads another plugin's DOM, and keeps `forced-colors` and `reduced-motion` branches.

## Fonts / 字体

| Role | Latin (embedded) | Chinese (install from `fonts/`) | License |
| --- | --- | --- | --- |
| Interface | Baloo 2 | `NotoSansSC-Regular.ttf` | [SIL OFL 1.1](<LICENSE-Baloo2.txt>) / [SIL OFL 1.1](<LICENSE-NotoCJK.txt>) |
| Code | Space Mono | `NotoSerifSC-Regular.ttf` | [SIL OFL 1.1](<LICENSE-SpaceMono.txt>) / [SIL OFL 1.1](<LICENSE-NotoCJK.txt>) |

Chinese for code is a **serif** on purpose: Space Mono is a geometric typewriter face, and the Chinese analogue of typing is Fangsong/Song printing rather than a geometric sans. It is not monospaced, so CJK columns in a code block still drift — the bundled font fixes the texture, not the grid.

Install the two TTFs on each machine that runs the theme:

- **Windows** — right-click the file → *Install for all users*, then restart DSH.
- **macOS** — double-click → Font Book → *Install*.
- **Linux** — copy to `~/.local/share/fonts/` and run `fc-cache -f`.

Without them the stacks fall through to PingFang SC / Microsoft YaHei, and the settings row reports the missing file.


## Preferences

`dsh-theme-jellyfish.accent` (`mint` · `sky` · `blossom` · `sun` · `peach` · `grape` · `leaf` · `coral`) and `dsh-theme-jellyfish.shape` (`classic` · `soft` · `round`). Invalid or unavailable storage falls back to mint and classic. Renaming the plugin from its previous preview ID changed these keys, so an earlier preview selection does not carry over.

## Runtime

Desktop only: a plain browser tab pointed at the same Host keeps the built-in theme. The plugin styles only its own settings row and brand slots, plus the page background and text selection; every other surface reads Theme tokens. Disabling releases the token layer, the stylesheet, both brand registrations and the settings row without deleting saved preferences.

The embedded Baloo 2 and Space Mono latin subsets are redistributed under [SIL OFL 1.1](<LICENSE-Baloo2.txt>) and [SIL OFL 1.1](<LICENSE-SpaceMono.txt>). The two Chinese TTFs in `fonts/` are Noto Sans SC and Noto Serif SC, redistributed under [SIL OFL 1.1](<LICENSE-NotoCJK.txt>); they are shipped for local installation and are **not** inlined into the client bundle.

## Verification

```powershell
node --check client.js
node --check index.js
node --test theme.test.js
```

Tests exercise the client service boundary, token contrast and the brand components' monochrome guarantee; they do not render React or a real desktop. Actual host token consumption, brand-slot precedence, compositing and keyboard behaviour still need a desktop check.
