# Smriti — Capability Roadmap

> Decided 2026-06-28. Updated as layers are completed.
> Companion: `docs/ConvoQA-2.md` for vocabulary decisions.

## Ambition

Smriti begins as a process description language (pravaaha source format). The ambition is wider: a self-sufficient language that can build platforms like pravaaha end-to-end — its own runtime, its own I/O, its own persistence, its own UI model.

This is not a general-purpose programming language. Smriti describes **structure, rules, processes, and systems**. Computation and execution are added as layers that serve that core purpose.

---

## Where Smriti is today

A **formal description + compilation** language:
- Describes processes, types, flows, participants, rights
- Typechecks and validates
- Compiles to YAML (pravaaha) and SVG (diagram)
- Evaluates trigger conditions (`smr trigger`)
- Cannot run a process, call HTTP, persist state, or render a UI

---

## Capability layers

### Layer 1 — Full Computation + Functions

**Key concept:** `kriya` (क्रिया) — named reusable computation block

**What's needed:**
- Complete expression evaluation (arithmetic, string ops, comparisons, collection ops on `krama`/`kosa`)
- `tarka` pattern matching — exhaustive on `satya`/`asatya`/`avyakta`
- `kriya` blocks: named, typed `aagama`/`nirgama`, callable from flow and from other `kriya`
- Recursion with tail-call guarantee (loops expressed as recursion, Paninian style)
- `smr eval` command for expression testing

**Unlock:** pravaaha CLI can be expressed in Smriti; diff logic, hash computation, semantic validation all become `kriya` blocks.

---

### Layer 2 — Mutable State

**Key concept:** `sthiti` (स्थिति) — already in vocabulary, not yet implemented

**What's needed:**
- Mutable state cells (not just immutable `varna` flow bindings)
- Scoping: local (within a `kriya`), process-scoped (within a running `.smr`), persistent (Layer 6)
- Assignment operator (token already exists: `=`)
- State lifecycle declaration on `smriti` blocks

**Unlock:** stateful process execution; counters, accumulators, running totals within a flow.

---

### Layer 3 — I/O and Effects

**Key concept:** explicit effect system — pure vs impure boundary

**What's needed:**
- `sparsha` block inside kriya declares effects (`http: read`, `file: write`, `event: emit`)
- Pure by default — compiler enforces no side effects when `sparsha` is absent
- HTTP: request/response with typed body (unlocks `smr fetch`)
- File: read/write
- Event emit/subscribe
- `smr run` can orchestrate I/O steps without a full executor

**Unlock:** `smr fetch` works; Smriti can talk to external systems; pravaaha registry HTTP endpoint consumable.

---

### Layer 4 — Runtime / Executor

**Key concept:** `smr run <file.smr>` — execute a process

**What's needed:**
- Process executor: advance through steps, evaluate guards (`khanda`), fork on `vibhaga`, wait on `anugama`
- Schedule runner: `hetu prati N unit` actually fires
- TypeScript interpreter first (development speed); WASM compile target after (portability)
- Step state machine: pending → running → svasti/anaapta
- `smr run --payload <json>` for external input

**Unlock:** Smriti processes are live, not just described. pravaaha can *run* an income-tax-filing process, not just validate its schema.

---

### Layer 5 — API / Service Layer

**Key concept:** `seva` (सेवा, proposed) — named HTTP endpoint

**What's needed:**
- `seva` block: declares method, path, typed request/response, bound to a `smriti` process or `kriya`
- `smr serve <file.smr>` — instantiate as a running HTTP server
- Authentication / authorization hooks (ties into Pramana eventually)
- OpenAPI/JSON Schema emission from `seva` declarations

**Unlock:** pravaaha's CLI becomes a `smr serve` target. The pravaaha registry API is declared in Smriti, not hand-written TypeScript.

---

### Layer 6 — Persistence

**Key concept:** `sangraha` (संग्रह, proposed) — persistent typed store

**What's needed:**
- `sangraha` block: named store with typed schema (maps to SQLite, Postgres, or file — backend pluggable)
- CRUD operations as `kriya` blocks bound to a `sangraha`
- Process instance tracking: a running `.smr` process has a persistent identity and state
- Migration model: schema changes versioned (same philosophy as pravaaha — no silent overwrites)

**Unlock:** pravaaha can track in-progress process instances (a tax filing in progress, a company registration at step 4). The registry is persistent. Audit logs are automatic.

---

### Layer 7 — UI / Component Model

**Key concept:** `darshana` (दर्शन, proposed) — UI component / view

Two paths, sequenced:

**Path 1 — Smriti as UI spec (near-term):**
- `darshana` block declares layout, data bindings, and event handlers in Smriti
- A renderer (React, native) interprets the `darshana` AST
- The pravaaha GUI visual builder is a React app that reads `.smr` files and renders them as editable UI
- SVG backend (already started) is the foundation for flow diagram rendering

**Path 2 — Smriti as UI language (far):**
- `darshana` is a full body type alongside `pravah`
- Component composition, state binding, conditional rendering — all in Smriti
- Compiles to WASM + platform-native renderer
- Enables indic-os native UI declared in Smriti

---

## Sequencing

```
Now         Layer 1 — kriya (full computation + functions)
            Wire evaluator.ts, define kriya syntax, smr eval command

Next        Layer 2 — sthiti (mutable state)
            + Layer 3 — I/O and effects (smr fetch unlocked)

Then        Layer 4 — smr run (runtime executor)
            Smriti processes are live

Then        Layer 5 — seva (API / service layer)
            smr serve works; pravaaha API declarable in Smriti

Then        Layer 6 — sangraha (persistence)
            Process instances tracked; registry persistent

Later       Layer 7 path 1 — darshana as UI spec
            pravaaha GUI builder reads .smr

Far         Layer 7 path 2 — darshana as native component model
            WASM + indic-os native UI

Far-far     Self-hosting — Smriti's own toolchain rewritten in Smriti
```

---

## What Smriti-built pravaaha looks like (full ambition)

```
pravaaha.smr          → process definitions        (Layer 1, works today)
pravaaha-api.smr      → seva blocks → smr serve    (Layer 5)
pravaaha-store.smr    → sangraha blocks             (Layer 6)
pravaaha-ui.smr       → darshana blocks → renderer  (Layer 7)
```

CLI, diff engine, hash computation, semantic validation — all `kriya` blocks. The pravaaha TypeScript codebase becomes an interim implementation, replaced layer by layer as Smriti gains capability.

---

## Open vocabulary (not yet locked)

| Term | Devanagari | Proposed meaning | Layer |
|------|-----------|-----------------|-------|
| seva | सेवा | HTTP service / endpoint | 5 |
| sangraha | संग्रह | Persistent typed store | 6 |
| darshana | दर्शन | UI component / view | 7 |
