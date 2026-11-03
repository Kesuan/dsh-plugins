# Animal Island 1.3.0 — P0/P1 polish

**Historical:** superseded by [1.4.0](animal-island-1.4.0.md), which adds light accent coverage and elevated dark popovers. The 1.3.0 comparison values remain valid for toolbar/Shiki/settings.

Date: 2026-11-03. Target: `plugins/themes/dsh-theme-animal-island` 1.2.0 → 1.3.0.
Profile: `desktop`. Existing GUI: http://127.0.0.1:59620.

## Scope

This iteration implements the agreed P0 and P1 items only:

1. **P0 — toolbar fill semantics.** `--dsw-alias-button-tool-bar-fill*` are
   backgrounds in the host toolbar component, but 1.2.0 wrote opaque label-like
   colours (`#bdbdb5`, `#b8b8af`, `#e9e8e4`). Dark default/hover measured
   1.54:1 / 1.00:1 against the toolbar label; light hover measured 2.25:1.
2. **P1 — island Shiki palette.** Nine host `--shiki-token-*` variables are now
   supplied. The default light Shiki palette had six of nine tokens below 4.5:1
   on the warm code-block surface.
3. **P1 — running shimmer.** `--dsw-alias-label-deep-diving-shimmer` now follows
   the accent instead of the host's static blue-300 mix.
4. **P1 — settings row and focus.** Light current-name and hint text move to
   plugin-owned `--aia-current` / `--aia-hint`; the light focus ring becomes the
   deeper gold `#9a6f00`.

## Changes

- Toolbar fills: light `#794f2714` / `#794f270a` / `#794f271f`; dark
  `#f5f4ef14` / `#f5f4ef0a` / `#f5f4ef24` (fill / invisible / hover).
- New Shiki tokens: constant, string, comment, keyword, parameter, function,
  string-expression, punctuation, link. Values are in
  [client.js](../../plugins/themes/dsh-theme-animal-island/client.js) and
  [DESIGN.md](../../DESIGN.md#colors).
- `--aia-current` `#6f614d` / `#d0cfc8`; `--aia-hint` `#7c6d58` / `#bdbdb5`.
- Focus ring light `#e0a800` → `#9a6f00`; dark stays `#ffcc00`.
- Token layer: 126 → 138 tokens; 16 existing/new tokens changed. No surface
  palette, accent ID/storage, light accent value or font precedence changed.

## Validation

- `node --check client.js` and `node --check index.js` pass.
- `node --test theme.test.js`: **9 pass / 0 fail**.
- Toolbar fills are asserted as 8-digit alpha values (< 0.2 alpha) and are
  composited before contrast checks: light 5.94/6.27/5.55:1, dark
  9.43/10.62/7.72:1.
- Light settings ink: current 3.85 → 5.63:1; hint 2.86 → 4.70:1. Focus:
  2.01 → 4.23:1 on base; 3.74:1 on layer 3.
- All nine Shiki tokens clear 4.5:1 on `#fdfcf6` light and `#323230` dark.
- Manifest/locale JSON parse; icon and embedded Nunito unchanged. `git diff
  --check` is clean.

## Comparison images

Token-level generated images (not desktop screenshots), with source/image
hashes:

- [toolbar](assets/animal-island-1.3.0/toolbar-before-after.png)
- [syntax](assets/animal-island-1.3.0/syntax-before-after.png)
- [settings](assets/animal-island-1.3.0/settings-before-after.png)
- [asset provenance](assets/animal-island-1.3.0/README.md)

## Runtime reload

The desktop client was restarted while granting screen-recording permission; the
GUI moved to http://127.0.0.1:59620. Theme inspection then listed the new
`--aia-current`, `--aia-hint`, `--dsw-alias-label-deep-diving-shimmer` and all
nine `--shiki-token-*` entries, and the `settings.general.item` slot still lists
`animal-island-accent` as active. This confirms the 1.3.0 client JavaScript is
loaded in the live composition; it is not a rendered visual pass. A window
capture was possible, but the visible window contained the user's live session
list and conversation, so it is not committed to the repository.

## Runtime and verification limits

The local package is linked from this checkout. A profile reinstall was not
performed for this source-only patch. `screencapture` now works after the OS
permission grant, but full UI navigation is unavailable because this process is
not trusted for Accessibility keystrokes. The comparison images therefore
remain token-level; no actual desktop screenshot is claimed.

Rendered toolbar states, code-block syntax, focus appearance, menu
compositing, placeholder opacity and narrow-width wrapping remain visually
unverified. The 1.2.0 record remains historical and its "visual pending" status
is not inherited as a pass; static checks are not visual acceptance.

## Historical record

The [1.1.0 verification](animal-island-verification.md) and
[1.2.0 revision](animal-island-1.2.0.md) remain historical. This 1.3.0 record
does not rewrite their conclusions.
