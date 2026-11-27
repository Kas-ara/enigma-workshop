# Project brief — Enigma Workshop

Date: 27 November 2026. Source: user request in The Lantern Council; brief by Astral Weaver (architect).
This document is authoritative. A decision that departs from it needs a record in `docs/decisions/` approved by the user.

## 1. Confirmed needs
- Modern web UI showing how Enigma machines work, several models.
- Animated 3D models, dark look, themes in the colours of the countries involved.
- History section.
- Encoder and decoder. The workshop also offers an explicit 2D view and a Live keyboard mode where the output lamp follows key press and release.
- GitHub repository created if needed; the user is told if they must act.
- English from day one, with French and German translations for the UI and historical content.

## 2. Scope
**v1:** exact, tested Enigma I / M3 / M4 engine; 2D workshop (settings, encoder, decoder, signal path); animated 3D scenes following the selected machine; sourced history timeline; dark theme; GitHub Pages deployment.
**Later:** other models (batches 2 and 3), languages beyond English, French and German, cryptanalysis mode (Turing bombe, Zygalski sheets), sharing a setup by link.
**Out of scope:** server, accounts, data collection, analytics, ads.

## 3. Architecture decisions (details in `docs/decisions/`)
| Topic | Decision |
|:--|:--|
| Site type | Static, no server, no accounts (ADR-001) |
| Tooling | Vite + strict TypeScript, Vitest, ESLint; npm |
| UI | TypeScript + lightweight Web Components; no heavy framework in v1 (ADR-002) |
| Engine | `src/engine/`, pure deterministic TypeScript, no DOM (ADR-003, `docs/ENGINE.md`) |
| Machine models | Declarative data in `src/engine/models/` |
| Encrypt / decrypt | Same function (reciprocity); two UI modes for teaching |
| Teaching trace | For each letter the engine returns rotor stepping and signal path; 2D and 3D only render it |
| 3D | Three.js, lazy-loaded, procedural geometry in v1; selectable 2D view and fallback; `prefers-reduced-motion` (ADR-004) |
| History | Markdown in `content/history/`, every fact sourced |
| Themes | CSS tokens per country in `src/ui/themes/`; no Nazi symbols (ADR-005) |
| Language | English by default, French and German; strings isolated in `src/i18n/` |
| Hosting | GitHub Pages via GitHub Actions |
| Repository | `Kas-ara/enigma-workshop`, private until v1 (to be confirmed) |

## 4. Target layout
```
src/engine/            engine, models, tests (no imports outside engine)
src/engine/models/     machine definitions (data)
src/ui/                2D workshop, themes
src/scene3d/           Three.js scene driven by the trace
src/i18n/              UI strings
content/history/       sourced timeline and articles
docs/                  brief, engine contract, decisions, credits
.github/workflows/     tests + Pages deployment
```
Dependency rule: `ui` and `scene3d` depend on `engine`, never the reverse; `scene3d` does not depend on `ui`.

## 5. Models, in batches
1. Enigma I, M3, M4: rotors I–VIII, Beta/Gamma, reflectors B, C, B-thin, C-thin, plugboard, double stepping.
2. Commercial D/K, Swiss-K, Italian Navy Enigma K, Railway (settable reflector where applicable).
3. Abwehr G (cog-driven stepping, multiple notches).
A model ships only with sourced test vectors (`docs/ENGINE.md` §4).

## 6. Milestones and definition of done
| Milestone | Done when |
|:--|:--|
| M1 Engine | `ENGINE.md` §4 vectors pass; batch 1 definitions covered; no DOM dependency |
| M2 2D workshop | Input, encode/decode round trip, full settings, signal path shown; keyboard-accessible |
| M3 3D | Scene in sync with the trace; lazy-loaded; 2D fallback; 60 fps on a recent Mac (to be measured) |
| M4 History & themes | Timeline and articles with sources; country themes approved by the user |
| M5 Release | CI green, site on Pages, Nightwatch review with no open P1/P2, visual sign-off by the user |

## 7. Roles and workflow
- **Runesmith:** implementation. **Astral Weaver:** architecture and decision records. **Silver Wisp:** UX, rendering, debugging. **Nightwatch:** code review at each milestone.
- One branch and PR per milestone; `main` always deployable; no publishing or public repo without user approval.
- Each PR states what is tested automatically and what still needs an on-screen check.

## 8. Open questions (user)
- Private or public repository from the start? (recommended: private)
- Final name: "Enigma Workshop" proposed (current folder: `Atelier Enigma`).
- Countries and services to represent in themes (proposal in ADR-005).
