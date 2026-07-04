# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-28 (archived)

All language gaps + infrastructure complete. 264 tests, 17 files. varna, apavaada/samapti data,
krama/kosa constraints, grammar v0.3, tree-sitter regenerated, sutra YAML backend.

---

## Session: 2026-06-28

**Commits:** cf7213f (L5 seva), fb3fbb0 (cross-step validation), a554140 (scheduling), 2a5fdbb (L6 sangraha)
**Tests:** 523 passing, 25 files

- **Layer 5 — seva:** HTTP endpoint declaration, `toOpenApi()` backend, `smr compile --openapi`. 29 tests.
- **Cross-step error validation:** handler `aagama` must cover `apavaadaNirgama`/`samaptiNirgama` fields. 11 tests.
- **Runtime scheduling:** `computeIntervalMs`, `smr schedule <file.smr> [--once]`. 21 tests.
- **Layer 6 — sangraha:** persistent store declaration, `toSchema()` backend, `smr compile --schema`. 36 tests.

---

## Session: 2026-07-04

**569 tests, 28 files by end of session. Commits:** 25be633/2766bd6 (L6.2), abef3e1/e8ba2bf
(kramana/rachana), 857b25b/a8c5c01 (ternary/recursion), 86f5c52/f3a4c45 (pravaaha YAML fixes),
plus the `smr fetch` HTTP wire-up below.

- **Layer 6.2 — sangraha flow wire-up:** `aavaha store.op` dispatches to the kriya bound to that
  operation. Typechecker validates op validity/binding and aagama/nirgama against the store's
  schema. Parser fix: `parseNameRef` now accepts keyword tokens as qualified-name members
  (`eatNameLike`) — sangraha op names collided with reserved words. 10 tests.
- **Collections & records:** `kramana` (iterate a krama/kosa inside a kriya, loop-scoped
  bindings, accumulator-via-assignment) + `rachana` (heterogeneous named-field record type,
  read via `member` expressions). Matrices and record lists work end-to-end. 19 tests.
- **Ternary + budgeted recursion:** `condition ? then : else` (the only branching construct
  inside a kriya) + a shared call-depth budget (`budget: number[]`, default 1000) so
  self-recursion fails cleanly instead of overflowing the JS stack. Fixed a `vakya + vakya`
  string-concat typecheck bug found in passing. `factorial(6) = 720` verified. 13 tests.
- **pravaaha YAML backend fixes:** real integration testing against pravaaha's actual schema
  found 3 bugs — rights need a `pramana` citation (enforced via `YamlBackendError` in the
  backend, not the typechecker), `authority.citation` → `authority.law`, implicit step
  fall-through now emits explicit `next:`. 4 tests.
- **`smr fetch` goes live:** pravaaha's new registry Worker (thin, self-hostable GitHub-repo
  resolver, no database) is live at `pravaaha-registry.srikarbuddhiraju.workers.dev`. `smr fetch
  <org/name@version>` now makes a real HTTP request (previously errored "registry not yet
  live"), overridable via `SMR_REGISTRY_URL`. `cli/index.ts`'s `run()` is now `async`.

Full design for all of the above in `docs/ConvoQA-3.md` and `docs/ConvoQA-4.md`.

## Open items

- [ ] **Layer 7 — darshana**: UI component/view declaration; far horizon
- [ ] **tree-sitter standalone**: separate session — own BharatOpenSource repo, nvim-treesitter, Linguist
- [ ] **String primitives beyond `+` concat** (length, substring, indexOf) — not scoped yet
- [ ] **Closures** — watch for a concrete use case before designing anything
- [ ] **Full pravaaha schema audit** — only rights/steps/terminals checked against the real
      schema so far; `references`/`uses`/`immutability`/`rights_reference` not yet verified
- [ ] **Grammar spec** (`spec/grammar.ebnf`) not yet bumped for kramana/rachana/ternary — stale at v0.5
