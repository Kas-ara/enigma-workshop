# Agent guidelines — Enigma Workshop

- Read `docs/BRIEF.md`, then `docs/ENGINE.md`, before any change. They are authoritative. Any deviation needs a record in `docs/decisions/` approved by the user.
- English is the project and default interface language. Keep French and German visitor-facing translations complete. (User decisions, 27 Nov 2026.)
- Keep UI strings in `src/i18n/` and localized historical entries in `content/history/`.
- Separate what is verified, what is chosen and what is unverified.
- `src/engine/` must not depend on UI code. Every engine change ships with tests.
- 2D/3D animations render the engine trace; they never recompute the cipher.
- No historical fact or test vector without a source listed in `docs/CREDITS.md`. Never invent a historical message.
- No Nazi symbols (see ADR-005).
- External assets only with a verified licence recorded in `docs/CREDITS.md`.
- Hosting: GitHub Pages only. No public repository or release without the user's approval.
- One branch and one PR per milestone; Nightwatch review before merge.
