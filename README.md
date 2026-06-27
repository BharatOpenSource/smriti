# Smriti (स्मृति)

*Sanskrit: स्मृति — that which is remembered. The body of recorded, authored, evolvable knowledge.*

> Part of [Bharat Open Source](https://github.com/BharatOpenSource)

A formal language for expressing processes, rules, and systems — rooted in Sanskrit, readable in any script.

## The idea

In Indian tradition, knowledge divides into two categories:

**Shruti** — revealed, timeless, not authored by humans. Unchangeable.
**Smriti** — recorded, authored, contextual, evolvable. The Dharmashastra texts — Manusmriti, Yajnavalkya Smriti — are Smriti. They codify how things should be done, who holds which rights, what the process is.

A versioned, auditable process registry is Smriti. And the language that defines those processes? That is Smriti.

## What it is

A domain-specific language with:
- **Sanskrit vocabulary** — every keyword is a Sanskrit word with precise semantic meaning
- **Any script** — write in Latin (IAST), Devanagari, Telugu, Kannada, or any Indic script; the lexer normalises all to the same canonical form
- **Formal grammar** — grammar-first design (PEG / Tree-sitter); the grammar document is the language specification
- **Full computation** — types, expressions, constraints; not just structure but logic
- **Multiple compilation targets** — the same `.smr` source renders as YAML, SVG flow diagram, plain language, and eventually native binary via LLVM

## File types

| Extension | Name | Contains |
|-----------|------|----------|
| `.smr` | Smriti file | A complete process definition |
| `.sut` | Sutra file | A reusable building block, importable by `.smr` files |

A `.sut` is a single reusable step or sub-procedure — published once, imported by many processes. When imported, its hash is locked at declaration time.

## Relationship to pravaaha

[pravaaha](https://github.com/BharatOpenSource/pravaaha) v0.1 uses YAML as its process format. Smriti becomes the primary source format in pravaaha v0.2+. The YAML schema becomes a compilation target, not the source.

## Compilation chain

```
.smr source (any script)
    ↓ parser (generated from formal grammar)
AST → Typed AST
    ↓
YAML         → pravaaha (v0.1)
SVG          → flow diagram (v0.2)
Plain text   → Indic language output (v0.2)
WASM         → portable runtime (v0.3+)
LLVM IR      → native binary (long term)
```

## Connection to indic-os

Smriti is designed to be the policy and configuration language for [indic-os](https://github.com/BharatOpenSource/indic-os) — expressing OS-level processes, service lifecycles, and user rights in the same language used to define any other process or system. The substrate and the application layer speak the same language.

## Current status

**Language design complete. Vocabulary locked. Grammar next.**

- [x] Architecture decisions locked: Sanskrit vocabulary, multi-script, grammar-first, full computation
- [x] File format: `.smr` (Smriti) and `.sut` (Sutra)
- [x] Sanskrit vocabulary — 47 terms locked (structural, flow, data, types)
- [ ] Formal grammar document
- [ ] Parser (generated from grammar)
- [ ] YAML renderer (pravaaha integration)
- [ ] VS Code extension

## The toolchain

The project is called **Sutra** — the tool that parses, validates, and compiles Smriti files. Like `tsc` compiles TypeScript, `smr` (the Sutra CLI) compiles `.smr` files.

## Part of

[Bharat Open Source](https://github.com/BharatOpenSource) — infrastructure built by India, for India.
