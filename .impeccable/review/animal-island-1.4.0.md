# Animal Island 1.4.0 — P2 accent coverage and popover elevation

Date: 2026-11-03. Target: `plugins/themes/dsh-theme-animal-island` 1.3.0 → 1.4.0.
Profile: `desktop`. Existing GUI: http://127.0.0.1:59620.

## Scope

This iteration implements the two P2 items:

1. **Light accents cover the site.** The light `--dsw-static-deepseek-*` ramp is
   derived from the selected brand instead of fixed mint. Light message bubbles,
   bubble highlight, business chips, sidebar badges, info fills, file-type
   accents and the running label now follow the accent.
2. **Dark popovers sit above layer 3.** Overlay, menu surface, toast and tooltip
   move from `#3b3a37` (layer 2) to `#4d4c47`; the tooltip keycap becomes
   `#5d5c56`.

## Changes

- Light brand ramp: 10/20/38/58/78/100% tile tints for stops 50–450,
  brand at 500, and 82/68/55/35/22% brand/black stops for 600–950. `--dsw-static-deepseek-500` is the brand itself; stops
  600–950 are the darker derived shades.
- Light selection is 28% brand; light active wash is 14% brand; the selected
  sidebar cell is 12% brand.
- `--dsw-alias-label-deep-diving` is now a direct brand/label mix, so its text no
  longer carries host static blue; the shimmer override from 1.3.0 remains.
- Dark elevated surface `#4d4c47` is above layer 3 `#44433f`. Tooltip keycap
  `#5d5c56`. The dark error ink is `#ecb0aa`; peach/grape/coral dark brands are
  slightly raised so accent text still clears 4.5:1 on the elevated surface.
- Token layer: 138 → 140. Light surfaces, accent IDs/storage, light brand values
  and user font precedence are unchanged.

## Validation

- `node --check client.js` and `node --check index.js` pass.
- `node --test theme.test.js`: **11 pass / 0 fail**.
- New tests assert light accent consumers differ across every accent, and dark
  overlay/menu/toast/tooltip luminance is above layer 3.
- Dark foreground contrast still passes across all eight accents and five
  surfaces, including the new elevated popover surface.
- Existing toolbar, settings-row, focus and Shiki checks remain green.
- Manifest/locale JSON parse; embedded Nunito and icon unchanged; `git diff
  --check` clean.

## Live check

The running desktop client already lists `--dsw-alias-label-deep-diving` and
`--dsw-specific-sidebar-nav-item-active` in Theme inspection, and the token
count has moved from 138 to 140. This confirms the 1.4.0 client JavaScript was
loaded by the live composition. In the live light window, the selected sidebar
cell and the user message bubble visibly carry the current mint tint, which is
consistent with the 1.4.0 coverage. This only exercises mint, not the other
seven accents; automatic UI navigation/clicking is still unavailable, and the
visible window contains the user's session content, so no desktop screenshot is
committed.

## Comparison images

Token-level generated images, with source/image hashes:

- [light accent coverage](assets/animal-island-1.4.0/accent-coverage-before-after.png)
- [dark popover elevation](assets/animal-island-1.4.0/popover-before-after.png)
- [asset provenance](assets/animal-island-1.4.0/README.md)

The earlier [1.3.0 evidence](animal-island-1.3.0.md) remains valid for the
toolbar/Shiki/settings fixes; those values are unchanged in 1.4.0.

## Verification limits

Rendered bubbles/chips/selection across all eight accents, menu compositing,
popover shadow behavior, tooltip keycaps, focus, placeholder opacity and narrow
layouts remain visually unverified. Static token checks are not visual
acceptance.

## Historical record

The [1.1.0 verification](animal-island-verification.md),
[1.2.0 revision](animal-island-1.2.0.md) and [1.3.0 polish](animal-island-1.3.0.md)
remain historical. This 1.4.0 record does not rewrite their conclusions.
