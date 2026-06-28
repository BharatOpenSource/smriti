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

### Semantics — updated 2026-06-27 (session 2)

Current implementation covers: metadata, sequential steps, binary/trivalent branching, parallel tracks, sub-process invocation, typed field declarations, cross-file composition, type constraints (scalar + collection inner types), evaluatable trigger/descriptor blocks, sutra inheritance with step overrides, named variable bindings (varna), per-step error/timeout data.

**Remaining gaps:**
- No runtime scheduling — hetu declares a schedule but nothing executes it
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

### varna — decided 2026-06-27

- `varna name : type [= expression]` — named data binding in the flow
- Produces a field with the given name and type; available to all subsequent flow items (vibhaga, pada, etc.)
- With `= expression`: computed from existing produced fields (e.g., `varna is-eligible : tarka = age >= 18 && income > 0`)
- Without expression: unbound typed slot — bound by runtime context or step output
- Identifiers in expr follow expression rules (no aagama constraint — it's not vrtti)

### per-step error/timeout data — decided 2026-06-27

- `apavaada: field (type), ...` on a `pada` — data the step produces when routing via apavaada
- `samapti: field (type), ...` on a `pada` — data the step produces when routing via samapti (timeout)
- Disambiguated from routing by colon (data) vs arrow (routing): both can appear on the same pada
- Typechecker validates: data fields must be well-typed; data without routing is an error
- Handler step's `aagama` should cover these fields (not yet enforced — cross-step validation is future work)

### krama/kosa inner type constraints — decided 2026-06-27

- Inner types in `krama[T]` and `kosa[K, V]` fully support constraints — parser was already recursive
- `krama[sankhya 0..100]`, `kosa[vakya, sankhya 0..1000]`, `krama[vakya "[A-Z]+"]` all valid
- `checkTypeConstraints()` is a module-level recursive function applied to all type positions
- smriti-level and sutra-level `aagama`/`nirgama` are now fully validated (was missing before)

### sutra compile target — decided 2026-06-27

- `smr compile <sutra-file>` emits YAML interface document: id, kind, version, owner, aagama, nirgama, steps
- Backend: `src/backends/sutra-yaml.ts` → `toSutraYaml(SutraDecl)`
- Intended use: publish the interface of a `.sut` for consumers who want to know its contract

### kriya — locked 2026-06-28

- `kriya` (क्रिया) — named reusable computation block (function). Panini's term for verbal root/action — the action itself, not a description of one.
- Distinct from `kaarya` (already taken: "what a step does" on a `pada`). `kriya` *is* the action; `kaarya` is the duty/task assigned to a step.

**Syntax — locked 2026-06-28:**
- `aagama`/`nirgama` blocks for inputs/outputs (consistent with `pada` and `sutra` — one pattern everywhere)
- Scope: both top-level in a `.smr`/`.sut` file (shared, importable via `sangama`) and inside `smriti`/`sutra` blocks (private/scoped)
- Call from flow — two forms:
  1. **Inline:** `varna name : type = kriya-name(args)` — for simple, single-assignment calls
  2. **Step:** `pada` with `kaarya: kriya name(args)` + `nirgama` — for named, multi-output, or actor-bound calls
- Effect declaration: `sparsha` block inside impure kriya lists what the kriya touches externally (`http: read`, `file: write`, `event: emit`)
- Pure by default — no `sparsha` block means the compiler enforces no side effects

```
kriya validate-amount {
  aagama
    amount   : sankhya
    currency : vakya

  nirgama
    result   : tarka
    reason   : vakya vikalpa

  result = amount > 0
  reason = "amount must be positive"
}

kriya fetch-gstin-status {
  sparsha
    http: read

  aagama gstin   : vakya
  nirgama status : vakya
}
```

### Smriti capability expansion — decided 2026-06-28, updated 2026-06-28

Seven capability layers. Layers 1–4 complete (426 tests). Layer 5 (seva) is next.

| Layer | Capability | Key concept | Status |
|-------|-----------|-------------|--------|
| 1 | Full computation + functions | `kriya` | ✓ done |
| 2 | Mutable state | `sthiti` | ✓ done |
| 3 | I/O and effects | effect system, sparsha | ✓ done |
| 4 | Runtime / executor + aavaha | `smr run`, registry | ✓ done |
| 5 | API / service layer | `seva` | ✓ done |
| 6 | Persistence | `sangraha` | ✓ done (schema; 6.2 = flow wire-up) |
| 7 | UI / component model | `darshana` | Far |

Full roadmap with sequencing: see `docs/roadmap.md`.

### Layer numbering — decided 2026-06-28

Registry + aavaha dispatch (our "Layer 5" in implementation) is an extension of the executor (Layer 4), not a standalone roadmap layer. The roadmap layer table above reflects the canonical numbering. `seva` = Layer 5.

### seva scope — decided 2026-06-28

**No HTTP server runtime. No new npm dependencies.**
`seva` is a compile-to-spec layer only: `smr compile --openapi <file.smr>` emits OpenAPI 3.1 JSON.
Language: `seva` block with method, path, typed aagama (request) + nirgama (response), bound to a `smriti` or `kriya`. Backend: `src/backends/openapi.ts`.

### smr fetch — decision 2026-06-28

Stays blocked. Needs a live pravaaha registry HTTP endpoint. `HttpAdapter` is defined (Layer 3). Will implement when pravaaha ships the endpoint.

### tree-sitter standalone — decision 2026-06-28

Separate session task (not a capability layer). Move `tree-sitter-smriti/` to its own BharatOpenSource repo, wire to nvim-treesitter, register with GitHub Linguist.

## Open Questions / Tasks

- [x] Cross-file resolution: `sangama` resolver, `RelativeFileResolver`, `RegistryResolver` stub
- [x] Type constraints: `sankhya` range, `vakya` pattern, `krama`/`kosa` inner type constraints
- [x] `ghatana` semantics: evaluatable trigger block, `smr trigger` CLI command
- [x] `sutra anuvṛtti`: inheritance + `aadesha` step override
- [x] `varna`: named binding in flow, produces typed field
- [x] Per-step error/timeout data: `apavaada: fields` / `samapti: fields`
- [x] Grammar spec v0.3: all features documented in `spec/grammar.ebnf`
- [x] Sutra compile target: `smr compile` works on `.sut` files
- [x] Tree-sitter v0.3: grammar.js + parser.c regenerated; highlights updated
- [x] Cross-step error data validation — `checkHandlerCoverage()` in typechecker
- [x] Runtime scheduling — `smr schedule`, `computeIntervalMs`, Sanskrit unit aliases
- [x] Layer 5 seva — OpenAPI 3.1 emit, `smr compile --openapi`
- [x] Layer 6 sangraha — JSON schema emit, `smr compile --schema`; vocabulary locked
- [ ] sangraha Layer 6.2 — `aavaha store.op` flow wire-up (switch prepared in typechecker)
- [ ] Registry HTTP fetch — blocked on pravaaha
- [ ] tree-sitter standalone — separate session
