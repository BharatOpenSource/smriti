# Sutra — Decisions & Open Questions

> 200-line limit — split into `ConvoQA-2.md` if exceeded.

## Decisions (locked)

### Name — confirmed 2026-06-26
- **Smriti (स्मृति)** — the language. File extension: `.smr`
- **Sutra (सूत्र)** — the atomic reusable unit within Smriti. File extension: `.sut`
- **Sutra** — the project/toolchain name (the parser, compiler, LSP, renderers)
- Relationship: a `.smr` file imports `.sut` files. Sutra is the tool that processes both.

### Language vocabulary — Sanskrit
The language's keywords are Sanskrit words. Script varies (Devanagari, Telugu, Kannada, Latin/IAST) — same word, different rendering. The lexer uses ICU transliteration to normalize any script to canonical IAST before matching keywords. One keyword table, all scripts supported.

### Grammar approach — grammar-first
Formal grammar written first (PEG or Tree-sitter notation). Parser is generated from the grammar. The grammar document IS the language specification. Hand-written parsers rejected — incompatible with the formal ambition.

### Fully Sanskrit — yes, with meta-notation
The vocabulary is fully Sanskrit. Structural syntax (brackets, arrows, operators) is a necessary meta-notation layer — the same way Panini used anubandhas (indicatory markers) that are not Sanskrit words but serve his grammar. Sanskrit vocabulary + formal meta-notation = Smriti.

### Full computation — plant foundation now, scale later
Smriti targets full computation (expressions, arithmetic, comparisons, constraints). v0.1 declares the type system; v0.2 implements expression evaluation. Grammar must support it from day one — adding types later breaks existing files.

### Renderer — inside the Sutra toolchain
A reference renderer ships with the Sutra toolchain. Start with YAML (for pravaaha), add SVG flow diagram next. The AST is the API contract — third parties can build additional renderers against it.

### Compilation chain
```
.smr source (any script)
    ↓ parser (generated from formal grammar)
AST
    ↓ type checker
Typed AST (canonical representation)
    ↓
Multiple backends:
  YAML        → pravaaha (v0.1)
  SVG         → flow diagram (v0.2)
  Plain text  → Indic language output (v0.2)
  JSON        → APIs (v0.2)
  WASM        → portable runtime (v0.3+)
  LLVM IR     → native binary / indic-os (far)
```

### Relationship to indic-os
Smriti can be the base for indic-os at multiple layers:
- **Policy layer** — immediately. OS processes, user rights, service lifecycles expressed in Smriti.
- **Configuration layer** — v0.2. Replaces YAML/HCL for system config.
- **Scripting layer** — v0.3+. Replaces bash once full computation is implemented.
- **Systems layer** (kernel, drivers, memory) — separate dialect, far future. Different design problem.

### Relationship to pravaaha and Pramana
The vocabulary connects all three projects:
- `pravah` (flow) — keyword in Smriti, same root as pravaaha
- `pramana` (authority/proof) — keyword in Smriti for rights citations, same name as the IAM project
This is architectural coherence from first principles, not coincidence.

### .smr vs .sut relationship
- `.smr` — a complete process definition (the whole recipe)
- `.sut` — a reusable building block (an importable technique used across many `.smr` files)
- Example: `pan-verification.sut` published by gov-india; imported by any `.smr` that needs PAN verification
- When a `.sut` is imported, its hash is locked at declaration time (same model as pravaaha process references)

## Open Questions / Tasks

- [ ] **VOCABULARY** — Srikar to coin 29 Sanskrit terms (see LatestTask.md)
- [ ] Grammar approach: PEG vs Tree-sitter (decision needed before parser work begins)
- [ ] Indic script rendering: decide canonical script for display (Devanagari recommended as Sanskrit's native script)
- [ ] v0.1 toolchain scope confirmation after vocabulary is locked
- [ ] GitHub repo creation for Sutra (currently local folder only)
