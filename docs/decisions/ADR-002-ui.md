# ADR-002 — No heavy UI framework in v1
Status: proposed.
Context: few views (workshop, scene, history); simple state owned by the engine.
Decision: TypeScript + lightweight Web Components; state in a small central store.
Rejected: React/Vue (upfront cost); plain 2D canvas as the UI (poor accessibility).
Revisit: adopt a framework if the UI grows beyond ~10 views or state becomes complex.
