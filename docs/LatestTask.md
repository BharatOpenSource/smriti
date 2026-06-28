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

- [x] tree-sitter: `npx tree-sitter generate` run; parser.c (8468 lines) committed; verified clean

**Remaining:**
- [ ] `smr fetch` HTTP (blocked on pravaaha)
- [ ] Extract tree-sitter-smriti/ to standalone repo for nvim/Linguist

## Session: 2026-06-28

**Capability expansion — roadmap locked:**
- [x] Smriti scope expanded: process description → self-sufficient language capable of building pravaaha end-to-end
- [x] 7-layer capability roadmap written to `docs/roadmap.md`
- [x] `kriya` (क्रिया) locked as vocabulary term for named reusable computation blocks (functions)
- [x] Proposed (not yet locked): `seva` (service), `sangraha` (persistence), `darshana` (UI component)
- [x] ConvoQA-2.md updated with kriya decision + layer table

**Next:** Layer 1 — implement `kriya` functions. Wire `evaluator.ts`, define syntax in grammar, add to parser + typechecker.

**Grammar v0.4 — kriya complete:**
- [x] `spec/grammar.ebnf` updated to v0.4
- [x] `kriya-decl` added at top-level and inside smriti/sutra bodies (scoped)
- [x] `kriya-body`: sparsha-decl? + aagama-decl? + nirgama-decl? + kriya-stmt+
- [x] `sparsha-decl`: effect declaration block (http/file/event × read/write/emit/read-write)
- [x] `kaarya-decl` extended: accepts string or `kriya invocation(args)` 
- [x] Expression grammar upgraded: arithmetic (+/-/*//%) + `call-expr` + unary `-`
- [x] Parser — `parseKriya()`, `parseSparsha()`, `parseKriyaBody()`, `parseKriyaStmt()`, `parseArgList()`; expression chain extended (arithmetic + call-expr); `kaarya` extended
- [x] AST — `KriyaDecl`, `SparshaDecl`, `SparshaField`, `KriyaStmt`, `AssignStmt`, `ExprStmt`, `CallExpr`, `ArithExpr`, `NegateExpr` — all added; `exprStr` updated
- [x] Lexer — `KRIYA`, `SPARSHA`, `PLUS`, `MINUS`, `STAR`, `SLASH`, `PERCENT` added
- [x] Tests — `tests/kriya.test.ts` — 38 tests covering lexer, parser, sparsha, scoped kriya, calls, arithmetic; 302/302 passing
- [x] Typechecker — `checkKriya()` + `checkSparsha()`; `checkExpression` extended for `arith`/`negate`/`call`; wired into `checkFile`/`checkSmriti`/`checkSutra`; 22 new tests (324 total)
- [x] Evaluator — `buildKriyaEnv()`, `evaluateKriya()`, `call` dispatch in `evaluate()`; `evaluateGhatana` receives env; CLI wired; 12 new evaluator tests (336 total)
- [x] Tree-sitter grammar — updated to v0.4: `kriya_decl`, `sparsha_decl`, `sparsha_field`, `kriya_body`, `assign_stmt`, `expr_stmt`, `call_expr`, `arg_list`, `add_expr`, `mul_expr`, `neg_expr`; `kaarya_value` extended; highlights.scm updated; `npx tree-sitter generate` clean; parse verified (0 ERROR nodes)

**Layer 2 — sthiti (mutable state) complete:**
- [x] AST — `SthitiField`, `SthitiBlock` added; `sthitiBlock?` on `SmritiDecl`, `SutraDecl`, `KriyaDecl`
- [x] Parser — `parseSthitiBlock()` added; `parseKriya()` now fully permissive (any header/stmt order); `sthiti` wired into smriti/sutra/kriya body parsing
- [x] Typechecker — `checkSthitiBlock()` (dup names, type constraints, init type compat); sthiti fields seeded into kriya body scope; called from checkSmriti/checkSutra/checkKriya
- [x] Evaluator — `buildInitialState()` exported; `evaluateKriya()` seeds sthiti cells before body; sthiti cells re-initialised per call (call-local)
- [x] Tree-sitter — `sthiti_block`, `sthiti_field` added to grammar; smriti/sutra/kriya bodies updated; `(sthiti_field name:) @variable.member` in highlights; regenerated clean (0 ERROR nodes)
- [x] Grammar EBNF — updated to v0.5: `sthiti-block` and `sthiti-field` rules; `kriya-body` now permissive; smriti/sutra bodies document sthiti scope
- [x] Tests — `tests/sthiti.test.ts` (26 tests): parser, typechecker, evaluator (362 total, 19 files)

**Layer 3 — I/O and Effects complete:**
- [x] `src/effects.ts` — `HttpAdapter`, `FileAdapter`, `EventAdapter`, `EffectAdapter`; null adapters for tests/dry-run
- [x] Typechecker — `collectImpureKriya()` builds file-wide set of kriya with sparsha; `checkKriya()` receives `impureKriya`; `checkExprPurity()` rejects calls to impure kriya from pure callers (with sparsha-block hint); recursion through arith/compare/logical/not/negate
- [x] CLI — `smr run <file.smr> --kriya <name> [--payload <json>]` executes kriya and prints nirgama as JSON; --kriya flag added to arg parser
- [x] Tests — `tests/layer3.test.ts` (21 tests): pure enforcement pass/fail, EffectAdapter interface, smr run execution path (383 total, 20 files)
- [x] Smoke test: `smr run run-test.smr --kriya add-tax --payload '{"amount":1000,"rate":0.18}'` → `{"total":1180,"tax":180}`

**Layer 4 — Process Executor complete:**
- [x] `src/executor.ts` — `executeSmriti()`, `executeFlow()` with full FlowItem dispatch: pada (guard, kaarya kriya, auto-complete), aadesha, varna, vibhaga, anubhaga (parallel), anugama (join no-op), aavaha (stub), sthiti (marker no-op), svasti/anaapta terminals
- [x] Routing: pravritti/prativritti jump via step-index map; budget guard (10,000 steps)
- [x] Parallel tracks: each track gets snapshot of produced; merge on join; anaapta in any track short-circuits
- [x] Kaarya positional mapping: pada.nirgama[i] ← kriya.nirgama[i] value (steps rename outputs)
- [x] Process sthiti: seeded at process start; payload overrides sthiti initial values
- [x] CLI: `smr run <file.smr> [--payload <json>]` executes smriti pravah, prints step log + outcome
- [x] Tests: `tests/executor.test.ts` (28 tests) — linear, guards, kaarya, varna, vibhaga, routing, parallel, sthiti, budget (411 total, 21 files)
- [x] Smoke test: gst-filing smriti with guard → varna → kriya dispatch → vibhaga → svasti

**Layer 5 — Process Registry + aavaha Dispatch complete:**
- [x] `src/registry.ts` — `Registry` interface, `buildRegistry(file)`: maps all smriti/sutra decls by name; `register()` for runtime additions
- [x] `src/executor.ts` — aavaha case: looks up target in registry, builds sub-process aagama from produced, runs sub-process with shared budget, writes nirgama back to parent produced, propagates child log and anaapta outcome; recursive aavaha protected by shared budget
- [x] `cli/index.ts` — wired `buildRegistry`; CLI picks LAST smriti in file as root process (helpers declared first); `smr run` passes registry to `executeSmriti`
- [x] Tests — `tests/registry.test.ts` (15 tests): buildRegistry, aavaha stub, sub-process invocation, aagama/nirgama pass-through, child log, anaapta propagation, unknown target, nested, recursive budget guard, sutra dispatch (426 total, 22 files)
- [x] Smoke test: loan-application smriti with aavaha kyc-verification sub-process → full step log showing parent + child steps (7 steps, svasti)
