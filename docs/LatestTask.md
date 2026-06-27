# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-27

**Status:** Toolchain active. 241 tests passing across 16 test files. #1–#9 complete.

**Completed this session:**

- [x] #8 `ghatana` semantics — evaluatable trigger/descriptor block on smriti
  - AST restructured: `GhatanaDecl` has optional fields `vrtti`, `hetu`, `karta`, `sthala`, `kaarya`
  - `vrtti` — boolean expression evaluated against payload (identifiers = aagama field names)
  - `hetu` — schedule: `prati N <unit>` (user-defined unit; `antara`, `day`, `submission`, etc.)
  - `karta`, `sthala`, `kaarya` — informational expressions (unconstrained identifiers — may be participants or literals)
  - New module `src/evaluator.ts`: `evaluate(expr, payload)`, `toTarka(value)`, `evaluateGhatana(ghatana, payload)`
  - Typechecker `checkGhatana()`: validates vrtti identifiers against smriti aagama; other fields expression-checked only
  - CLI: `smr trigger <file> --payload <json>` — evaluates ghatana, prints all field results, exits 0/1 on fires/no-fires
  - `src/backends/svg.ts` — ghatana header line updated (removed old `.items[0]` reference)
  - 34 new tests in `tests/ghatana.test.ts` (parsing, typechecking, evaluator, toTarka, evaluateGhatana)

- [x] #9 `sutra anuvṛtti` — sutra inheritance with Pāṇinian override semantics
  - Lexer: `anuvrtti`, `aadesha` added as keywords
  - AST: `SutraDecl.parent?: NameRef`, `AadeshaDecl` (kind: 'aadesha', target: string, pada: PadaDecl) added to FlowItem
  - Parser: `parseSutra()` checks for `anuvrtti` after name; `parsePadaBody()` extracted (shared by parsePada + parseAadesha); `parseAadesha()` added
  - Typechecker: aadesha treated as its pada in flow + collectProduced; collectStepNames tracks aadesha targets
  - `hetu` unit parsing fix: keywords (like `antara`) accepted as unit names (not restricted to IDENTIFIER)
  - 6 new tests in `tests/inheritance.test.ts` (anuvṛtti parsing, aadesha parsing, typechecking)

- [x] Example files updated to use expression-based ghatana syntax
  - `gst-refund-claim.smr`: `vrtti: gstin != "" && refund-category != ""`, hetu/karta/sthala/kaarya set
  - `software-release-pipeline.smr`: `vrtti: service-name != "" && version-tag != ""`, same fields

**Test count: 241 (was 207)**

**All pending from #8/#9 design discussion — complete.**

**Full pending list:** see `docs/todo.md`
