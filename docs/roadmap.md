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
Flow wire-up prepared: `aavaha store.op` TODO comment in `checkAavaha` — one block to turn on.
36 tests.

**Layer 6.2 (next):** `aavaha filings.likha` dispatch in typechecker + executor.

---

### Layer 7 — UI / Component Model
**Key concept:** `darshana` (दर्शन) — UI component / view

Two paths, sequenced:

**Path 1 — Smriti as UI spec (near-term):** `darshana` block declares layout, data bindings, event handlers. A renderer (React, native) interprets the AST. SVG backend is the foundation.

**Path 2 — Smriti as UI language (far):** `darshana` is a full body type. Compiles to WASM + platform-native renderer. Enables indic-os native UI declared in Smriti.

---

## Sequencing

```
Done        Layers 1–6 — kriya, sthiti, effects, executor + aavaha registry, seva, sangraha
            Cross-step error validation, runtime scheduling also complete

Next        Layer 6.2 — sangraha flow wire-up
            aavaha store.op dispatch in typechecker + executor

Then        Layer 7 — darshana (UI spec)

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
| sangraha | संग्रह | Persistent typed store | 6 | Done — JSON schema emit; flow wire-up = 6.2 |
| darshana | दर्शन | UI component / view | 7 | Proposed |
