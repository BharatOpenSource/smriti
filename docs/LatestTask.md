# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-27

**Status:** All language gaps + infrastructure complete. 264 tests, 17 files. #1–#9 + all gaps done.

**Language gaps — all complete:**

- [x] **`varna`** — named variable / data binding in the flow
  - `VarnaDecl { kind: 'varna'; name: string; varnaType: SmritiType; expr?: Expression }`
  - Added to `FlowItem` union, `parseVarna()` in parser, `checkVarna()` in typechecker
  - `collectProduced` includes varna field → available to downstream vibhaga/steps
  - Syntax: `varna is-valid : tarka = amount > 0` or `varna label : vakya`

- [x] **Per-step error/timeout data**
  - `apavaadaNirgama?` and `samaptiNirgama?` on `PadaDecl`
  - Disambiguated from routing: `apavaada → step` (routing) vs `apavaada: field (type)` (data)
  - Typechecker validates data fields are well-typed; errors if data declared without routing
  - Syntax: `apavaada → handle-error` + `apavaada: error-code (vakya), reason (vakya)`

- [x] **`krama`/`kosa` constraints** — inner types already supported by recursive `parseType()`;
  - Added `checkTypeConstraints()` module-level function (recursive — handles nested collections)
  - `checkSmriti()` and `checkSutra()` now call `checkTypedFields()` on process-level aagama/nirgama
  - Sutra aagama now seeded as external inputs to `checkFlow` (same as smriti)
  - `krama[sankhya 0..100]`, `kosa[vakya, sankhya 0..1000]`, `krama[vakya "[A-Z]+"]` all work

- [x] **Grammar spec sync** — `spec/grammar.ebnf` rewritten to v0.3:
  - ghatana: 5 evaluatable fields (vrtti as expression, hetu as prati N unit, karta/sthala/kaarya)
  - anuvrtti + aadesha, varna-decl, apavaada/samapti data, range/pattern constraints on scalars
  - `=` (EQ) token added to lexer for varna expression binding

**Infrastructure — all complete:**

- [x] **`sutra` compilation target** — `src/backends/sutra-yaml.ts` → `toSutraYaml()`
  - CLI dispatches sutra files to this backend; outputs id/kind/version/aagama/nirgama/steps YAML
  - `smr compile <file.sut>` now works end-to-end

- [x] **Tree-sitter grammar update** — `tree-sitter-smriti/grammar.js` updated to v0.3:
  - Added: `anuvrtti`, `aadesha_decl`, `varna_decl`, `scalar_type` with `range_constraint`
  - Added: `apavaada_data`, `samapti_data`, updated `trigger` with 5 evaluatable fields
  - `highlights.scm` updated: aadesha/varna highlight groups, `=`/`..` operators, `prati`/`anuvrtti`
  - Note: `tree-sitter generate` not re-run (binaries unchanged); needs run before nvim wiring

**Test count: 264 (was 241)**

**Remaining:**
- [ ] `smr fetch` HTTP (blocked on pravaaha)
- [ ] tree-sitter: run `npx tree-sitter generate` + extract to standalone repo for nvim/Linguist
