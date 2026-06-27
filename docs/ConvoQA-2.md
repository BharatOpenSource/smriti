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

### Semantics — in progress 2026-06-27

Current implementation covers: metadata, sequential steps, binary/trivalent branching, parallel tracks, sub-process invocation, typed field declarations, cross-file composition.

**Known gaps (design choices to make, not bugs):**
- No expression language — `niyama` only matches literal values, not computed conditions
- No formal data flow — aagama/nirgama names not verified to connect between steps
- No constraints on types (e.g., `sankhya` with a range, `vakya` with a pattern)
- No per-step error paths — only global `anaapta`
- No samaya escalation — SLA declared but no routing on timeout
- No sutra inheritance (anuvṛtti) — `.sut` files can be invoked but not extended
- Trigger (`ghatana`) is descriptive only — no evaluatable schedule or event condition

## Open Questions / Tasks

- [x] Cross-file resolution: `sangama` resolver implemented — `RelativeFileResolver`, `RegistryResolver` stub, namespacing, circular import detection
- [ ] Semantics: expression language, formal data flow, per-step error paths, samaya escalation
- [ ] Indic script rendering: canonical display script (Devanagari recommended)
- [ ] Tree-sitter grammar for highlighting (after LSP stable)
- [ ] Registry resolver: actual implementation of `org/name@version` format
- [ ] `aavaha` qualified names: invoking an imported sub-process via `gov.pan-verification`
