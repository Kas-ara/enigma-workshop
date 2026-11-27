# ADR-006 — English from day one
Status: accepted (user decision, 27 Nov 2026).
Decision: English is the default for the UI and history, and is used for code, comments, commits and documentation. The user also requested complete French and German translations of the visitor-facing experience.
Consequence: English UI strings in `src/i18n/en.ts` define the translation keys. French and German dictionaries implement the same keys. Historical entries are translated in `content/history/`.
