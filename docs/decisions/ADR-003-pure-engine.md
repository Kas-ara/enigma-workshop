# ADR-003 — Pure, data-driven engine
Status: proposed.
Decision: engine without DOM; machines described as data; per-letter trace consumed by 2D and 3D.
Why: testable accuracy, new models without new code, animations faithful to the computation.
Consequence: every animation comes from the trace, never from a cipher recomputed in the UI.
