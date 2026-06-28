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

### Vocabulary — locked 2026-06-27

**Structural (16 terms)**

| Term | Devanagari | Meaning |
|------|-----------|---------|
| smriti | स्मृति | Complete process definition — outer container of `.smr` |
| sutra | सूत्र | Reusable building block — outer container of `.sut` |
| paksha | पक्ष | Named participant — specific person, org, or system |
| bhumika | भूमिका | Abstract role — the position a participant fills |
| adhikara | अधिकार | A right or entitlement |
| pramana | प्रमाण | Legal/normative authority citation backing a right |
| adhipati | अधिपति | Owner / author of the process |
| aavartana | आवर्तन | Version |
| stara | स्तर | Access level — public / restricted / private |
| avadhi | अवधि | Compliance delay — days before change takes effect |
| prabhaava | प्रभाव | Effective date — when this version comes into force |
| sthala | स्थल | Specific jurisdiction / place |
| kshetra | क्षेत्र | Broader region / domain (super-scope of sthala) |
| sangama | संगम | External reference — where flows meet (another process/system) |
| lagna | लग्न | Pinpointed reference — exact who/what/when/where |
| yuja | युज | Import connector — the act of connecting a reference |

**Flow (18 terms)**

| Term | Devanagari | Meaning |
|------|-----------|---------|
| ghatana | घटना | Process trigger — what starts this process |
| vrtti | वृत्ति | Trigger sub-type: a condition becoming true |
| hetu | हेतु | Trigger sub-type: a cause, purpose, or schedule |
| pravah | प्रवाह | Flow block — container for all steps and routing |
| pada | पद | A single named step |
| karta | कर्ता | Actor — who performs this step |
| kaarya | कार्य | Action — what the step does |
| aagama | आगम | Inputs to a step |
| nirgama | निर्गम | Outputs of a step |
| samaya | समय | Per-step time limit / TTL |
| khanda | खण्ड | Guard clause — condition that must be true before step executes |
| pravritti | प्रवृत्ति | Forward movement to next step |
| prativritti | प्रतिवृत्ति | Loop back to a previous step |
| svasti | स्वस्ति | Success terminal — process ends here successfully |
| anaapta | अनाप्त | Failure terminal — process ends here rejected or failed |
| vibhaga | विभाग | Branching point — multiple exclusive paths |
| niyama | नियम | Condition evaluated at a branch point |
| anubhaga | अनुभाग | Parallel split — launch concurrent tracks |
| anugama | अनुगम | Parallel join — wait for all tracks to complete |
| aavaha | आवाह | Sub-process invocation — call another `.smr` |

**Data (2 terms)**

| Term | Devanagari | Meaning |
|------|-----------|---------|
| varna | वर्ण | Named variable / data binding between steps |
| sthiti | स्थिति | Named intermediate workflow state |

**Types (13 terms + 3 values)**

| Term | Devanagari | Meaning |
|------|-----------|---------|
| sankhya | संख्या | Whole number |
| bhinnaanka | भिन्नांक | Fraction (1/3, 3/7) |
| dashaamsha | दशांश | Decimal (3.14, 0.5) |
| vakya | वाक्य | Text |
| tithi | तिथि | Calendar date |
| antara | अन्तर | Time span |
| tarka | तर्क | Logic / boolean type — holds satya, asatya, or avyakta |
| satya | सत्य | tarka value: true |
| asatya | असत्य | tarka value: false |
| avyakta | अव्यक्त | tarka value: indeterminate — neither true nor false; unresolved, pending, or error. Catches what satya and asatya do not. Rooted in Samkhya (the unmanifest) and Advaita (that which is neither real nor unreal). |
| patra | पत्र | Document or file reference |
| krama | क्रम | Ordered list / sequence |
| kosa | कोश | Key-value map / dictionary |
| vikalpa | विकल्प | Optional modifier — marks a field as not required |

**Notes**
- `tarka` with three values (`satya`/`asatya`/`avyakta`) is trivalent logic. Exhaustive matching on a `tarka` expression must handle all three — `avyakta` is the catch-all for unresolved states, analogous to a third branch in a try-catch.
- `sthala`/`kshetra` are a two-level jurisdiction pair: specific place vs broader domain.
- `sangama`/`lagna` are a two-level reference pair: external flow meeting point vs pinpointed exact reference.
- `ghatana` is the trigger block; `vrtti` and `hetu` are sub-type qualifiers within it.
- `varna` (color) as variable name is historically grounded: Indian mathematics used color names for unknowns.
- `vikalpa` is Panini's term for optional rules — directly applicable here.

**Computation (2 terms) — locked 2026-06-28**

| Term | Devanagari | Meaning |
|------|-----------|---------|
| kriya | क्रिया | Named reusable computation block (function). Panini's term for verbal root/action. |
| sparsha | स्पर्श | Effect declaration block inside impure kriya — "what it touches externally" (HTTP, file, events). |

### Toolchain — locked 2026-06-27

- **Implementation language:** TypeScript
- **Parser:** Hand-written recursive descent — one function per grammar rule. Same approach as Go, Rust, TypeScript compilers. Full control over error messages and recovery.
- **Grammar spec:** Formal EBNF document at `spec/grammar.ebnf` — the publishable language standard. Parser implements it; both change together.
- **Editor integration:** LSP server (TypeScript, after parser stable) + thin Tree-sitter grammar for highlighting only (GitHub, Neovim).
- **v0.1 target:** YAML emitter → pravaaha v0.2
- **CLI binary:** `smr` (like `tsc` for TypeScript)
- **Self-hosting:** Bootstrap in TypeScript. When Smriti has full computation + WASM runtime, rewrite Sutra in Smriti itself.

### Sanskrit notation — decided 2026-06-27

**Context:** `(){}[]` are Western mathematical imports (Cantor, Euler). Sanskrit solved the same structural problems differently.

**Relevant Sanskrit traditions:**
- **Pāṇini's Ashtadhyayi** — formal grammar notation using anuvṛtti (rule inheritance), IT markers (meta-information on rules, like `vikalpa`), and `iti` (इति) as a named-close marker. No visual brackets — structure from position and context.
- **Mathematical verse** — Sanskrit math written in shloka (metered verse). Structure from word order and metre, not punctuation. No `;` equivalent.
- **Daṇḍa (`।`)** — Sanskrit sentence-end marker. Equivalent to `.` or `;`.

**Decisions:**
- `iti` (इति) added as optional named-close: `} iti block-name`. Validates that the close matches the opener. Useful for deep nesting. Optional — existing files without `iti` remain valid.
- `।` (U+0964) reserved for future use as statement separator.
- `{}` retained for structural grouping — removing them hurts parser error recovery and editor tooling.
- Pāṇinian philosophy (anuvṛtti = rule inheritance) to influence **semantics**: sutra inheritance, field propagation — not syntax.

> Continued in [ConvoQA-2.md](ConvoQA-2.md) — general description language, sangama resolver, semantics, open tasks.
