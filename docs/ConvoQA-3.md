# Smriti — Decisions & Open Questions (continued)

> Continued from [ConvoQA-2.md](ConvoQA-2.md).
> 200-line limit — split into `ConvoQA-4.md` if exceeded.

## Decisions (locked, continued)

### Cross-step error data validation — decided 2026-06-28

When a `pada` step declares `apavaadaNirgama` or `samaptiNirgama`, the handler step's
`aagama` must now cover all those fields with matching types. Enforced in `checkPada` via
`checkHandlerCoverage()`. Terminals (`svasti`/`anaapta`) are exempt — no handler to check.

Type mismatch is an error, not a warning. Missing field is an error. Extra fields in the
handler's `aagama` are allowed (handler can accept more than what's produced).

### Runtime scheduling — decided 2026-06-28

`hetu: prati N unit` in a ghatana block is now executable, not just declarable.

**CLI:** `smr schedule <file.smr> [--payload <json>] [--once]`
- Reads `hetu` from the root smriti's ghatana
- Checks `vrtti` before each run — skips if condition is false
- Runs `executeSmriti` on a setInterval loop (Ctrl+C to stop)
- `--once`: execute one run immediately without waiting for the interval

**`src/scheduler.ts`:** `computeIntervalMs(quantity, unit)` — pure, testable converter.

Supported units:

| Unit | ms | Sanskrit alias |
|---|---|---|
| ms / millisecond(s) | 1 | — |
| s / second(s) | 1,000 | sel |
| min / minute(s) | 60,000 | — |
| h / hour(s) | 3,600,000 | ghanta |
| d / day(s) | 86,400,000 | dina |
| w / week(s) | 604,800,000 | saptaha |

`antara` is NOT a scheduling unit — it is a Smriti type (`antara` = duration/interval). Users
must pick an explicit unit. This is intentional to avoid type/unit confusion.

### sangraha vocabulary — locked 2026-06-28

| Term | Devanagari | Meaning | Role |
|---|---|---|---|
| `sangraha` | संग्रह | collection/store | block keyword |
| `mukhya` | मुख्य | primary/chief | primary key field |
| `vivara` | विवर | detail/descriptor | schema field declarations |
| `likha` | लिख | write | write/upsert op → kriya name |
| `pathana` | पठन | reading | read-by-key op → kriya name |
| `uddhaara` | उद्धार | extraction | query/list op → kriya name |
| `lopa` | लोप | elision (Pāṇinian) | delete op → kriya name |

All four ops are optional — a read-only store can omit `likha` and `lopa`.

**mukhya constraint:** must be a scalar type (vakya, sankhya, bhinnaanka, dashaamsha,
tithi, antara, tarka). krama, kosa, and patra are rejected — collections cannot be keys.

### sangraha scope — decided 2026-06-28

**Layer 6 = pure schema.** `sangraha` declares a typed store; `smr compile --schema` emits
JSON (`{ version, stores[] }` with key, fields, operations map). No runtime storage engine.
No new npm dependencies.

**Flow-aware wire-up is prepared but not active.**  
`aavaha store-name.op-name` (e.g. `aavaha filings.likha`) will be the syntax when wired.
The typechecker has a TODO comment at the exact insertion point in `checkAavaha`. The `AavahaDecl`
already supports qualified NameRef. Wire-up adds one validation block — no AST changes needed.

**Compile target format:** JSON, not SQL DDL or Prisma schema. Backend-neutral. Same approach
as seva → OpenAPI: emit a well-defined spec, let the consumer choose the storage engine.

### sangraha Layer 6.2 — flow wire-up — decided 2026-07-04

`aavaha store.op` now dispatches to the kriya bound to that sangraha operation. Design:

- **Op validity:** `op` must be one of `likha`/`pathana`/`uddhaara`/`lopa`, and must actually be
  bound on the store (ops are optional — a read-only store has no `likha`/`lopa`).
- **Schema check:** every `aagama`/`nirgama` field on the `aavaha` step must match a field on the
  store (mukhya or vivara) by name and type — the step's fields ARE the store's schema, not the
  bound kriya's own parameter names.
- **Key requirement:** `pathana` (read) and `lopa` (delete) act on one identified record, so their
  `aagama` must include the mukhya field. `likha` (upsert) and `uddhaara` (query) don't require it —
  upsert provides the whole record, query may filter on anything or nothing.
- **Executor dispatch:** looks up the store by namespace, resolves the bound kriya via `env`, builds
  positional args from the step's own `aagama` values (already present in flow context — validated
  above), calls `evaluateKriya`, binds the result back into `nirgama` positionally (same convention
  as `kaarya: kriya name(...)` in a `pada`).
- **Parser fix required:** `store.likha` failed to parse — qualified-name members required
  `TokenKind.IDENTIFIER`, but `likha`/`pathana`/`uddhaara`/`lopa` are reserved keywords. Fixed by
  accepting any word-like token after the dot (`parseNameRef` → `eatNameLike`), since a keyword
  cannot start a new statement in that position — no grammar ambiguity introduced.

### kramana + rachana — collections and records — decided 2026-07-04

**Motivation:** kriya bodies could declare `krama[T]`/`kosa[K,V]` fields but had no way to walk
them (no loop construct) and no heterogeneous named-field type to put inside them (only scalars).
Basic arithmetic worked; anything matrix- or record-shaped was inert data you could pass around
but never process. This closes that gap.

**`kramana` — iteration:**
- Syntax: `kramana item : collection { body }` (krama, one binding) or
  `kramana key, value : collection { body }` (kosa, two bindings).
- `collection` is a plain identifier already in scope (an aagama or sthiti field, or a name
  assigned earlier in the body) — no arbitrary expressions, no index access.
- Bindings are scoped to the loop body only. Assignments inside the body to names that already
  existed before the loop (an accumulator, e.g. `total = total + item`) propagate back out —
  this is how you get a sum/reduce today, since there's no separate reduce primitive.
- Loops nest freely — `kramana row : rows { kramana cell : row { ... } }` walks a
  `krama[krama[sankhya]]`, i.e. a matrix.
- Typechecker (`checkIterate`): collection must resolve to a declared krama/kosa; binding count
  must match (1 for krama, 2 for kosa); body is checked recursively with bindings added to a
  local scope that doesn't leak.
- Evaluator: `executeKriyaBody`/`executeIterate` in `src/evaluator.ts` run the body against a
  shared mutable `locals` object per iteration — arrays back krama values, plain objects back
  kosa/rachana values (`EvalValue` extended to include both). Loop bindings are deleted from
  `locals` once the loop ends.

**`rachana` — heterogeneous record type:**
- Syntax: `rachana[field1 (type1), field2 (type2), ...]` — same bracket idiom as `krama[T]`/
  `kosa[K,V]`, so it composes the same way: `krama[rachana[...]]` is a list of records.
- New `member` expression (`item.field`, chainable — `item.a.b`) is the only way to read a
  rachana field. Parser: `eatNameLike` for the field name (same fix as the Layer 6.2 qualified-
  name bug — field names shouldn't be restricted to non-keywords either).
- Typechecker treats member access like identifiers/calls — deferred, 'unknown' category, no
  deep field-type binding at this pass (matches the existing shallow rigor of kriya-body
  checking; `checkTypeConstraints` does recurse into rachana fields for duplicate-name /
  constraint validation at the type-declaration level).

**Not done (deliberately out of scope):** no index-based access into krama, no map/filter/reduce
primitives beyond accumulator-via-assignment, no `break`/`continue`, no arithmetic/comparison
operators on krama/kosa/rachana values themselves (only usable via `kramana` + member access).
These are still real gaps if/when Smriti moves toward self-hosting.

19 new tests in `tests/kramana.test.ts` (552 total). Verified end-to-end via `smr run --kriya`
for both a `krama[krama[T]]` matrix sum and a `krama[rachana[...]]` payroll sum.

## Open Questions / Tasks

- [ ] Layer 7 — darshana (UI component model) — Path 1: spec emit; Path 2: native component (far)
- [ ] tree-sitter standalone — separate session (own repo, nvim-treesitter, Linguist)
- [ ] smr fetch — blocked on pravaaha registry endpoint
