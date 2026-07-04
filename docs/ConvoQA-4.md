# Smriti — Decisions & Open Questions (continued)

> Continued from [ConvoQA-3.md](ConvoQA-3.md).
> 200-line limit — split into `ConvoQA-5.md` if exceeded.

## Decisions (locked, continued)

### YAML backend fixes — pravaaha integration — decided 2026-07-04

**Context:** pravaaha wired up `.smr` as a source format (`pvh validate`/`publish` shell out to
`smr compile` and parse the result). First real end-to-end test against pravaaha's actual
`process.schema.json` surfaced three genuine bugs in `src/backends/yaml.ts`, none caught before
because smriti's own tests only asserted against smriti's *understanding* of pravaaha's schema,
not the schema itself.

**1. Rights require a backing authority — enforced in the backend, not the typechecker.**
pravaaha's schema makes `authority.law` mandatory on every declared right — no naked rights
claims (a deliberate governance decision from pravaaha's own design session). Smriti's `pramana`
(authority citation) is optional and participant-scoped, not per-right — valid Smriti can declare
`adhikara` (rights) with no `pramana` at all. Rather than loosen pravaaha's schema or silently
drop unbacked rights from the compiled output, `buildRights()` in `toYaml()` now **throws** a
`YamlBackendError` naming the participant and the missing right. This keeps the constraint where
it belongs: `pramana` stays optional in core Smriti (other backends, or a future non-pravaaha use
of Smriti, aren't forced into this rule) — it's specifically the *pravaaha-targeting* backend
that enforces pravaaha's *policy*. `smr compile` (CLI) catches `YamlBackendError` and reports it
cleanly instead of crashing.

**2. `authority.citation` → `authority.law`.** Plain key-name bug — pravaaha's schema has never
had a `citation` field (`additionalProperties: false` on the authority object), only `law` (+
optional `section`/`article`). Fixed the key; no policy question here.

**3. Implicit fall-through made explicit as `next`.** Smriti's own executor treats an unrouted
`pada` as "fall through to the next flow item" (`cursor + 1`) — no explicit routing needed.
pravaaha's step model has no such concept: every step must declare an explicit exit
(`next`/`conditions`/`loop_back`/`terminal`), or pravaaha's semantic validator rejects it as a
dangling step. `buildSteps()` now back-fills `next` for any step with no explicit exit, pointing
at whatever comes right after it in the flow — mirroring what the Smriti executor already does
at runtime, just made visible in the compiled artifact.

**4. Dropped the `outcome` field on terminal steps** (`svasti`/`anaapta`) — not part of
pravaaha's schema, and redundant with `terminal: true` + the step `id` (svasti always succeeds,
anaapta always fails, by construction).

**Verified end-to-end:** a full invoice-payment-style `.smr` process (2 parties with `pramana`,
6 steps including a `vibhaga` branch and a `prativritti` loop-back) now passes `pvh validate`
cleanly against the real schema, and `pvh publish` reaches the confirmation prompt correctly. A
process missing `pramana` fails at `smr compile` with the new clear error, surfaced through
pravaaha's own error reporting rather than a confusing downstream schema-validation failure.

4 new tests in `tests/yaml.test.ts` (569 total).

## Open Questions / Tasks

- [ ] Grammar spec (`spec/grammar.ebnf`) not yet bumped for kramana/rachana/ternary — v0.5 is stale
- [ ] Are there other pravaaha schema fields smriti's YAML backend still doesn't emit correctly
      (e.g. `references`, `uses`, `immutability`, `rights_reference`)? Only rights/steps/terminals
      have been checked against the real schema so far — this was a spot-check, not a full audit
