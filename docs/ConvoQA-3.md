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

## Open Questions / Tasks

- [ ] Layer 7 — darshana (UI component model) — Path 1: spec emit; Path 2: native component (far)
- [ ] sangraha Layer 6.2 — flow wire-up: `aavaha store.op` validation in typechecker + executor
- [ ] tree-sitter standalone — separate session (own repo, nvim-treesitter, Linguist)
- [ ] smr fetch — blocked on pravaaha registry endpoint
