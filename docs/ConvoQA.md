# Sutra — Decisions & Open Questions

> 200-line limit — split into `ConvoQA-2.md` if exceeded.

## Decisions (locked)

### Vision
A domain-specific language for expressing institutional and civic processes. Practical goal: clean, precise, formally defined grammar — readable by non-technical people. Ambitious goal: become the standard for process expression, inspired by Panini's Ashtadhyayi.

### Relationship to pravaaha
Sutra is the language; pravaaha is the platform. pravaaha v0.1 uses YAML. Sutra becomes the primary format in pravaaha v0.2+. The YAML schema is a compilation target once Sutra is ready.

### Sequencing (locked 2026-06-26)
Build pravaaha v0.1 in YAML first. Real process definitions (income tax, company registration, invoice payment) will reveal what constructs the language needs. Design the grammar from empirical data, not in a vacuum.

### Name
**Tentative: Sutra (सूत्र)** — Sanskrit for thread, formula, rule. Panini's grammar is written as sutras. Final name TBD.

## Open Questions

- [ ] Final name for the language
- [ ] Grammar approach — hand-written parser or grammar-first (PEG, EBNF, etc.)?
- [ ] What constructs are first-class keywords vs. library-defined?
- [ ] Indic script support — rendering target only, or source language too?
- [ ] Compilation targets — YAML (pravaaha), visual diagram, plain language (Hindi/Telugu/etc.)
- [ ] Tooling — LSP (editor support), formatter, linter
