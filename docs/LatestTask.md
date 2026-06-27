# Latest Task — Smriti

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-27

**Status:** Toolchain active. 178 tests passing across 13 test files. #1–#5 complete and pushed.

**Completed this session:**
- [x] `apavaada` (अपवाद) — per-step exception routing: `apavaada → handler-step`
- [x] `samapti` (समाप्ति) — SLA timeout routing; requires `samaya` on same step
- [x] Keyword renames: viparyaya → apavaada, kalaatigata → samapti (full rename)
- [x] #1 Grammar spec sync — `spec/grammar.ebnf` rewritten to v0.2; fully in sync with parser
- [x] #2 `aavaha` qualified names — `aavaha gov.pan-verification` for imported sub-process invocation
- [x] #3 Typechecking gaps — `anugama` validation, parallel track data flow context, terminal check fix
- [x] #4 Indic script rendering — `src/scripts.ts` label tables; `toSvg(decl, { script: 'devanagari' })`
  - CLI: `smr compile --svg --script devanagari file.smr`
  - 9 labels mapped to Devanagari; font-family switches to Noto Sans Devanagari stack
  - metaLine offset widens 48→80 px for wider Devanagari glyphs
- [x] #5 Tree-sitter grammar — `tree-sitter-smriti/` directory added to repo
  - `grammar.js` — full grammar authored in tree-sitter DSL, mirrors `spec/grammar.ebnf` v0.2
  - `src/parser.c` — 184K generated C parser committed (zero-install for editors)
  - `queries/highlights.scm` — nvim-treesitter highlight groups mapped for all node types
  - All constructs covered: smriti/sutra, metadata, paksha, sangama/lagna, pravah, pada,
    apavaada, samapti, vibhaga/niyama, anubhaga/anugama, aavaha, sthiti, expressions
  - Two key grammar fixes during generation:
    1. Body rules (`smriti_body`, `pada_body`, etc.) use `optional($.body)` at parent +
       `repeat1()` inside — tree-sitter forbids syntactic rules matching empty string
    2. Removed unnecessary `conflicts` declaration — tree-sitter resolved `name_ref`
       (qualified vs bare identifier) automatically via lookahead
  - Verified: `tree-sitter parse tests/sample-test.smr` produces clean parse tree, no errors
  - Bindings scaffolded for Node, Python, Rust, Go, Swift, C by `tree-sitter generate`
  - To wire into Neovim: point nvim-treesitter parser source at `tree-sitter-smriti/`
  - For GitHub Linguist: needs extraction to standalone `BharatOpenSource/tree-sitter-smriti` repo

- [x] Example `.smr` files — three files in `examples/`, all pass `smr check`
  - `gst-refund-claim.smr` — Indian GST refund process (government workflow), demonstrates:
    all metadata fields, aagama/nirgama, paksha×3, samaya, apavaada/samapti, vibhaga on tarka,
    prativritti loop (respond-to-notice loops back to scrutinize), two svasti terminal paths
    (normal disbursement and CGST Act Section 54(7) deemed-approval path)
  - `software-release-pipeline.smr` — CI/CD release pipeline, demonstrates:
    sangama import, paksha×4, anubhaga (3 parallel tracks), anugama join,
    aavaha qualified sub-process invocation (smoke-tests.run-suite), sthiti wait state,
    pravritti loop-back to post-incident-review
  - `smoke-test-suite.smr` — supports the sangama import in the release pipeline
- [x] Typechecker fix — `collectProduced` was not collecting nirgama from `aavaha` steps;
    vibhaga on aavaha-produced fields was incorrectly rejected. Two regression tests added.
- **Test count: 180 (was 178)**

**Next session — starting with:**
- [ ] #6 Registry resolver — `org/name@version` format for `sangama` imports

**Full pending list:** see `docs/todo.md`
