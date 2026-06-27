# Sutra — Decisions & Open Questions (continued)

> Continued from [ConvoQA.md](ConvoQA.md).
> 200-line limit — split into `ConvoQA-3.md` if exceeded.

## Decisions (locked, continued)

### Smriti as general formal description language — decided 2026-06-27

**Decision:** Smriti is a general formal description language, not a process-only language.

- `smriti` = a named, formal description of any structured thing. **What it contains determines what it is.**
- `pravah` (process flow) is the primary use case and remains the main target for tooling and backends.
- `pravah` is **optional**. A `smriti` without `pravah` is valid — it may declare participants, metadata, references, or rules only.
- Future body types (layout, schema, ruleset) extend the language without breaking existing files.
- Backends determine how they interpret the content — a declaration-only `.smr` renders as an entity diagram in SVG, is invalid for YAML (which requires a flow), and so on.

**What this is not:** a general-purpose programming language. Smriti describes structure, rules, and processes. Computation lives in the expression layer (future).

### Cross-file composition — sangama resolver — decided and implemented 2026-06-27

**Design:**
- `sangama gov { yuja: "./participants.smr" }` → `gov` is the namespace
- Qualified reference: `karta: gov.citizen` — namespace prefix + participant name
- DOT (`.`) added as a token; parser produces `QualifiedName { namespace, name }`
- `nameRefStr()` helper renders `"gov.citizen"` in all output backends

**Pluggable resolver interface (`SmritiResolver`):**
- `RelativeFileResolver` — resolves `"./path.smr"` relative to the importing file
- `RegistryResolver` — stubs `"org/name@version"` with clear error: use relative path for now
- Strategy picked from `yuja` format: starts with `.`/`/`, or ends with `.smr`/`.sut` → relative file; otherwise → registry
- Circular import detection via `visiting` set on the call stack (allows diamond imports; rejects true cycles)
- `resolveImports(ast, fromPath)` is the public API — called by CLI before typecheck, by LSP with graceful fallback

**Type libraries:** kept open. Resolver imports everything the referenced file exports. No hardcoding — extensible as language grows.

**Namespacing is not optional.** `gov.citizen` never collides with `ministry.citizen`. Two sangama blocks can import from the same file under different namespace names.

**Namespacing is scalability.** Flat participant imports break at scale. Qualified names are the only correct design for systems that grow across teams and organizations.

### Semantics — updated 2026-06-27

Current implementation covers: metadata, sequential steps, binary/trivalent branching, parallel tracks, sub-process invocation, typed field declarations, cross-file composition, type constraints, evaluatable trigger/descriptor blocks, sutra inheritance with step overrides.

**Remaining gaps:**
- No per-step error paths beyond `apavaada` — no error *data* flows to handler
- No samaya escalation — SLA declared but no runtime scheduling
- No registry resolver HTTP fetch — blocked on pravaaha shipping `smr fetch` HTTP endpoint
- No formal output validation — nirgama values are declared but not runtime-checked

### ghatana semantics — decided 2026-06-27

- `ghatana` block has five optional fields: `vrtti`, `hetu`, `karta`, `sthala`, `kaarya`
- `vrtti` — boolean expression evaluated against smriti aagama fields; identifiers must be aagama names; determines whether process fires
- `hetu` — schedule: `prati N <unit>` where unit is user-defined (any word: `antara`, `day`, `submission`, etc.)
- `karta`, `sthala`, `kaarya` — informational context; identifiers unconstrained (may name participants, be string literals, or reference aagama data)
- All five fields are evaluatable expressions — `smr trigger <file> --payload <json>` evaluates and prints all
- `smr trigger` exits 0 when vrtti is satya (or absent), exits 1 when vrtti is asatya or avyakta

### sutra anuvṛtti — decided 2026-06-27

- `anuvrtti` (Pāṇinian carryover) — keyword declaring parent sutra: `sutra child anuvrtti base { ... }`
- `aadesha` (Pāṇinian substitute, आदेश) — replaces a named parent step: `aadesha step-name { ... body ... }`
  - Chose `aadesha` over `pratipada` (counter-step) — Pāṇinian term for substitution is more precise
- Delta model: child declares additional aagama/nirgama; aadesha replaces a parent step's body; new steps append before terminals
- Same-file and cross-file (qualified name) parents both supported
- `aadesha` inner pada has no `iti` name — it's a replacement body, not a new named step

## Open Questions / Tasks

- [x] Cross-file resolution: `sangama` resolver implemented — `RelativeFileResolver`, `RegistryResolver` stub, namespacing, circular import detection
- [x] Type constraints: `sankhya` range (`0..100`), `vakya` pattern (`"[A-Z0-9]+"`)
- [x] `ghatana` semantics: evaluatable trigger block, `smr trigger` CLI command
- [x] `sutra anuvṛtti`: inheritance + `aadesha` step override
- [ ] Registry HTTP fetch — `smr fetch <uri>` without `--from` (blocked on pravaaha)
- [ ] Per-step error data flow — `apavaada` step receives no typed error data yet
- [ ] Samaya escalation — SLA timeout routing beyond `samapti → step`
- [ ] Formal grammar sync — `spec/grammar.ebnf` needs update for ghatana/anuvrtti/aadesha
