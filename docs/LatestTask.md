# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-27 (archived)

All language gaps + infrastructure complete. 264 tests, 17 files. varna, apavaada/samapti data,
krama/kosa constraints, grammar v0.3, tree-sitter regenerated, sutra YAML backend.

---

## Session: 2026-06-28

**Commits:** a69c7a1 (Layers 1–4), 788c7cf (Layer 5)
**Tests:** 426 passing, 22 files

### Layer 1 — Computation (kriya) ✓
- `kriya` keyword, `sparsha` effects block, `aagama`/`nirgama` typed I/O, arithmetic + call expressions
- Evaluator: `buildKriyaEnv()`, `evaluateKriya()`; CLI: `smr run --kriya <name> [--payload <json>]`
- 72 tests in `tests/kriya.test.ts`

### Layer 2 — Mutable State (sthiti) ✓
- `sthiti { field (type) = init }` in kriya (call-local) / smriti/sutra (process-scoped)
- `SthitiBlock`/`SthitiField` AST; `buildInitialState()` in evaluator; typechecker dup/type checks
- 26 tests in `tests/sthiti.test.ts`

### Layer 3 — I/O and Effects ✓
- `src/effects.ts`: `HttpAdapter`, `FileAdapter`, `EventAdapter`, `EffectAdapter`, null adapters
- Typechecker: `collectImpureKriya()` + `checkExprPurity()` — pure kriya cannot call impure
- 21 tests in `tests/layer3.test.ts`

### Layer 4 — Process Executor ✓
- `src/executor.ts`: `executeSmriti()` / `executeFlow()` — full FlowItem dispatch
- pada: khanda guard, kaarya kriya (positional nirgama mapping), auto-complete
- vibhaga routing, pravritti/prativritti jump, anubhaga parallel (snapshot/merge)
- Budget guard: 10,000 steps shared across all recursive track calls
- CLI: `smr run <file.smr> [--payload <json>]` prints step log + outcome
- 28 tests in `tests/executor.test.ts`

### Layer 5 — Process Registry + aavaha ✓
- `src/registry.ts`: `buildRegistry(file)` — maps smriti/sutra decls by name
- Executor aavaha: lookup → build child aagama → run with shared budget → write nirgama back → fold log
- anaapta in child propagates to parent; recursive aavaha bounded by shared budget
- CLI: picks LAST smriti as root (sub-processes declared first); registry passed to executor
- 15 tests in `tests/registry.test.ts`

**Smoke tests:**
- `smr run --kriya add-tax --payload '{"amount":1000,"rate":0.18}'` → `{"total":1180,"tax":180}`
- `smr run gst-filing.smr --payload '{"amount":50000,"taxpayer-type":"registered"}'` → svasti (4 steps)
- `smr run loan-application.smr --payload '{"pan":"ABCDE1234F","amount":500000}'` → svasti (7 steps, aavaha)

---

## Open items

- [ ] Layer 6 — TBD (discuss with Srikar: `seva` services, `sangraha` persistence, LSP, pravaaha integration)
- [ ] `smr fetch` HTTP (blocked on pravaaha)
- [ ] Extract `tree-sitter-smriti/` to standalone repo for nvim/Linguist
- [ ] Tree-sitter grammar needs update to v0.4+ (kriya/sthiti/sparsha — grammar.js updated but highlights may drift)
