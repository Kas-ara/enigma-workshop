# ADR-001 — Static site
Status: proposed (27 Nov 2026).
Context: no user data, light computation, simple publishing needed.
Decision: Vite + TypeScript, static build published on GitHub Pages.
Rejected: Node server (unnecessary); third-party hosted site builders (lock-in, no owned repository).
Consequences: all ciphering runs in the browser; no hosting cost.
