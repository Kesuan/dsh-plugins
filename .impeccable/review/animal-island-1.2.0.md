# Animal Island 1.2.0 — screenshot-driven revision

**Historical:** 1.2.0 has been superseded by [1.3.0](animal-island-1.3.0.md). This record remains the 1.2.0 evidence; its visual-pending status is unchanged.

## User evidence and direction

The actual 2560×1392 screenshot of 1.1.0 showed green throughout sidebar, canvas, message bubble and composer. The user rejected the green cast, weak hierarchy and lack of a light, playful Animal Island character. The earlier source-only ship is not a visual pass.

A discussion confirmed **clean warm charcoal with a little mint**. The region proposal was shared before implementation: neutral canvas and input/bubble, deeper sidebar, gray-white text, accent confined to selection/links/actions, rounded details retained. No font or layout rewrite was requested.

## Implemented changes

- Both night neutral primitive ramps and semantic surfaces are nearly neutral, rather than green. This includes primitives used by existing host chrome.
- Sidebar `#20201f`, canvas `#292928`, layers `#323230` / `#3b3a37` / `#44433f`. Overlay uses layer 2; module uses layer 1.
- Main ink `#e9e8e4`, dim ink `#d0cfc8`, secondary `#bdbdb5`. Toolbar roles use readable neutral ink; shadows no longer have a green tint.
- Ordinary hover remains neutral. Active fill follows the selected accent at 18% with transparency; default brand/link mint remains `#8bd5ba`.
- Eight accent IDs, storage key, font defaults/user priority, desktop gate, existing geometry and disposal behavior remain.
- No host DOM, layout or replacement server changes.

## Validation

- Client JavaScript syntax passes.
- Six Node tests pass: paired tokens, dark text contrast, ordered surfaces, accent-independent neutral shell/ink, desktop gate, fallback and lifecycle cleanup. All measured solid foreground combinations pass 4.5:1 across eight accents and five surfaces. These are service-boundary checks, not React/DOM rendering.
- All 1,008 light token comparisons against the saved 1.1.0 implementation match.
- Impeccable detector returns no findings. Manifest/locales parse; icon remains the original exported resource.
- Actual linked package resolves to this checkout at version 1.2.0.

## Installation

The supported plugin manager removed and reinstalled the same local linked bundle; final result: `application: applied`, version 1.2.0, enabled true, no warnings.

Profile: `desktop`. Existing GUI: http://127.0.0.1:51345. After installation the Host entry and Client settings slot are present. Profile manifest, patch, lockfile and workspace YAML match their backup; other plugin selections remain unchanged.

Backup, including the 1.1.0 plugin directory: `C:\Users\KSG\.dsh\backups\animal-island-redesign-20261103-105021`.

## Review scope and remaining visual check

A fresh independent review of the supplied screenshot identified four material fixes: remove the green from both aliases and primitives, restore surface luminance tiers, reserve mint for accents, and improve weak text/control roles. The independent follow-up verdict is **SOURCE ACCEPTED / VISUAL PENDING**. Removal of the global green cast, surface hierarchy and restrained accents are resolved in the implementation. Weak text/control roles are partly resolved: candidate tokens are readable, but actual placeholder/token consumption, additional opacity and rendered font sizes remain unverified. No further material code blocker was identified; no new visual pass was issued.

No new screenshot or browser-control capability is available. The supplied screenshot depicts the rejected 1.1.0 and cannot verify 1.2.0. Stable slot IDs and an applied installation also do not prove the new JavaScript generation is on screen. Refresh the desktop interface; restart DSH if the green theme remains. Actual placeholder rendering, selection strength, button foreground combinations and final visual acceptance remain open for the user's refreshed view.
