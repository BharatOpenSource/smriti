# Smriti — Capability Roadmap

> Decided 2026-06-28. Updated as layers are completed.
> Companion: `docs/ConvoQA-2.md` for vocabulary decisions.

## Ambition

Smriti begins as a process description language (pravaaha source format). The ambition is wider: a self-sufficient language that can build platforms like pravaaha end-to-end — its own runtime, its own I/O, its own persistence, its own UI model.

This is not a general-purpose programming language. Smriti describes **structure, rules, processes, and systems**. Computation and execution are added as layers that serve that core purpose.

---

## Capability layers

### Layer 1 — Full Computation + Functions ✓
**Commit:** a69c7a1

`kriya` — named reusable computation block. Arithmetic, comparisons, call expressions, `sparsha` effect declarations. `buildKriyaEnv()` + `evaluateKriya()` in evaluator. 72 tests.

---

### Layer 2 — Mutable State ✓
**Commit:** a69c7a1

`sthiti` — mutable state cells. Call-local in `kriya`, process-scoped in `smriti`/`sutra`. `SthitiBlock`/`SthitiField` AST. 26 tests.

---

### Layer 3 — I/O and Effects ✓
**Commit:** a69c7a1

Explicit effect system. `sparsha` block inside impure kriya declares effects. `EffectAdapter` interface (HttpAdapter, FileAdapter, EventAdapter) with null adapters. Typechecker enforces pure boundary. `smr run --kriya <name>`. 21 tests.

**Note:** `smr fetch` HTTP deferred — needs live pravaaha registry endpoint.

---

### Layer 4 — Runtime / Executor ✓
**Commit:** a69c7a1 (executor), 788c7cf (registry + aavaha)

`smr run <file.smr>` executes the full pravah. `src/executor.ts` dispatches all FlowItem kinds: pada (guard/kaarya/auto-complete), vibhaga, anubhaga (parallel), pravritti/prativritti routing, aavaha sub-process dispatch. `src/registry.ts` maps all smriti/sutra decls by name for aavaha lookup. Shared step budget (10,000) across all recursive calls. 28 + 15 = 43 tests.

---

### Layer 5 — API / Service Layer (OpenAPI) ✓
**Commit:** cf7213f

`seva` — named HTTP endpoint declaration. method, path, typed aagama (request) + nirgama (response).
`smr compile --openapi <file.smr>` emits OpenAPI 3.1 JSON. Path params from `{name}` templates;
GET/DELETE → query params; POST/PUT/PATCH → request body. No runtime, no new deps. 29 tests.

---

### Layer 6 — Persistence ✓
**Commit:** 2a5fdbb

`sangraha` — named persistent store. mukhya (primary key, scalar-only), vivara (schema fields),
optional op bindings: likha/pathana/uddhaara/lopa → named kriya.
`smr compile --schema <file.smr>` emits `{ version, stores[] }` JSON. No runtime storage engine.
Typechecker validates key type, no duplicate fields, op bindings reference real kriya.

### Layer 6.2 — sangraha flow wire-up ✓

`aavaha store.op` (e.g. `aavaha items.likha`) dispatches to the kriya bound to that operation.
Typechecker validates: op is one of likha/pathana/uddhaara/lopa and is bound on the store;
aagama/nirgama fields match the store's mukhya + vivara schema by name and type; pathana/lopa
additionally require the mukhya field in aagama (they act on one identified record). Executor
looks up the store by namespace, calls the bound kriya with aagama values from the flow context,
and binds its nirgama back positionally — same call convention as `kaarya: kriya name(...)`.

Parser fix along the way: qualified-name members (`store.likha`) previously required
`TokenKind.IDENTIFIER`, but sangraha op names are reserved keywords — `parseNameRef` now accepts
any word-like token after the dot (`eatNameLike`), not just plain identifiers.

10 new tests in `tests/sangraha-flow.test.ts`.

---

### Cross-cutting additions ✓ (not layer-numbered — full design in ConvoQA-3.md/ConvoQA-4.md)

- **Collections & records** — `kramana` (iterate a krama/kosa inside a kriya body, loop-scoped
  bindings, accumulator-via-assignment) + `rachana` (heterogeneous named-field record type,
  nestable inside krama/kosa, read via `member` expressions). Matrices
  (`krama[krama[sankhya]]`) and record lists (`krama[rachana[...]]`) work end-to-end. 19 tests.
- **Ternary + budgeted recursion** — `condition ? then : else` (the only branching construct
  inside a kriya) plus a shared call-depth budget (`evaluate`/`evaluateKriya` thread
  `budget: number[]`, default 1000) so self-recursion fails cleanly instead of overflowing the
  JS stack. Also fixed `vakya + vakya` string concatenation, wrongly rejected by the
  typechecker. Verified with `factorial(6) = 720`. Closures deliberately deferred. 13 tests.
- **pravaaha YAML backend fixes** — real integration testing against pravaaha's actual schema
  (not smriti's assumptions) found 3 bugs: rights need a `pramana` citation (enforced via
  `YamlBackendError` in the backend, not the typechecker — pravaaha's policy, not Smriti's),
  `authority.citation` → `authority.law`, and implicit step fall-through now emits explicit
  `next:`. 4 tests.
- **`smr fetch` goes live** — pravaaha's new registry Worker (thin, self-hostable GitHub-repo
  resolver, no database) is live at `pravaaha-registry.srikarbuddhiraju.workers.dev`; `smr fetch`
  hits it by default, overridable via `SMR_REGISTRY_URL`. Closes the `sangama`/registry import
  seam that was stubbed since the resolver was first built.

Running total: 569 tests, 28 files.

---

### Layer 7 — UI / Component Model
**Key concept:** `darshana` (दर्शन) — UI component / view

Two paths, sequenced:

**Path 1 — Smriti as UI spec (near-term):** `darshana` block declares layout, data bindings, event handlers. A renderer (React, native) interprets the AST. SVG backend is the foundation.

**Path 2 — Smriti as UI language (far):** `darshana` is a full body type. Compiles to WASM + platform-native renderer. Enables indic-os native UI declared in Smriti.

---

## Sequencing

```
Done        Layers 1–6 + 6.2 — kriya, sthiti, effects, executor + aavaha registry, seva,
            sangraha, sangraha flow wire-up (aavaha store.op)
            Cross-step error validation, runtime scheduling also complete
            Collections & records — kramana (iteration) + rachana (record type)
            Ternary + budgeted recursion; pravaaha YAML fixes; smr fetch (registry) live

Next        Layer 7 — darshana (UI spec)

Later       Layer 7 path 1 — darshana as UI spec
            pravaaha GUI builder reads .smr

Far         Layer 7 path 2 — darshana as native component model
            WASM + indic-os native UI

Far-far     Self-hosting — Smriti's own toolchain rewritten in Smriti
```

---

## What Smriti-built pravaaha looks like (full ambition)

```
pravaaha.smr          → process definitions          (Layer 1–4, works today)
pravaaha-api.smr      → seva blocks → OpenAPI emit   (Layer 5)
pravaaha-store.smr    → sangraha blocks               (Layer 6)
pravaaha-ui.smr       → darshana blocks → renderer    (Layer 7)
```

CLI, diff engine, hash computation, semantic validation — all `kriya` blocks.

---

## Open vocabulary

| Term | Devanagari | Proposed meaning | Layer | Status |
|------|-----------|-----------------|-------|--------|
| seva | सेवा | Service endpoint declaration | 5 | Done — OpenAPI emit |
| sangraha | संग्रह | Persistent typed store | 6 | Done — JSON schema emit + flow wire-up (6.2) |
| kramana | क्रमण | Iterate over a krama/kosa in a kriya body | — | Done |
| rachana | रचना | Heterogeneous named-field record type | — | Done |
| darshana | दर्शन | UI component / view | 7 | Proposed |
