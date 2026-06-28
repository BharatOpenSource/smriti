# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-28 (archived)

All language gaps + infrastructure complete. 264 tests, 17 files. varna, apavaada/samapti data,
krama/kosa constraints, grammar v0.3, tree-sitter regenerated, sutra YAML backend.

---

## Session: 2026-06-28 (current)

**Commits:** cf7213f (L5 seva), fb3fbb0 (cross-step validation), a554140 (scheduling), 2a5fdbb (L6 sangraha)
**Tests:** 523 passing, 25 files

### Layer 5 — seva (service endpoint declaration) ✓
- `seva` block: method, path, typed aagama + nirgama, optional itiName
- Typechecker: validates HTTP verb, path starts with `/`, field types
- `src/backends/openapi.ts`: `toOpenApi()` — OpenAPI 3.1 JSON; path params, query params, request body, response body, optional fields
- CLI: `smr compile --openapi <file.smr>`
- 29 tests in `tests/seva.test.ts`

### Cross-step error data validation ✓
- Typechecker `checkHandlerCoverage()`: when step A declares `apavaadaNirgama`/`samaptiNirgama`,
  handler B's `aagama` must cover all fields with matching types
- Terminals (`svasti`/`anaapta`) exempt from check
- 11 new tests across `tests/apavaada.test.ts` and `tests/samapti.test.ts`

### Runtime scheduling ✓
- `src/scheduler.ts`: `computeIntervalMs(quantity, unit)` — converts hetu to ms
- Supported units: ms, second(s), minute(s), hour(s), day(s), week(s) + Sanskrit aliases
- `antara` explicitly rejected (Smriti duration type ≠ scheduling unit)
- CLI: `smr schedule <file.smr> [--once]` — runs executeSmriti on hetu interval, checks vrtti before each run
- 21 tests in `tests/scheduler.test.ts`

### Layer 6 — sangraha (persistent store declaration) ✓
- `SangrahaDecl`: mukhya (primary key, must be scalar), vivara (schema fields), likha/pathana/uddhaara/lopa op bindings
- Typechecker: mukhya required + scalar-only; no duplicate vivara; op bindings validated against file kriya
- Flow-aware TODO in `checkAavaha` — `aavaha store.op` wire-up point for Layer 6.2
- `src/backends/schema.ts`: `toSchema()` — `{ version, stores[] }` JSON
- CLI: `smr compile --schema <file.smr>`
- 36 tests in `tests/sangraha.test.ts`

---

## Open items

- [ ] **Layer 7 — darshana**: UI component/view declaration; far horizon
- [ ] **sangraha Layer 6.2 — flow wire-up**: `aavaha store.op` in typechecker + executor; switch already prepared
- [ ] **tree-sitter standalone**: separate session — own BharatOpenSource repo, nvim-treesitter, Linguist
- [ ] **smr fetch HTTP**: blocked — needs live pravaaha registry endpoint
