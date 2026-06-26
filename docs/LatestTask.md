# Latest Task — Sutra

> Rolling log. Current session only — 1-2 sessions max. 200-line limit.

## Session: 2026-06-26

**Status:** Language design QA complete. Grammar approach locked. Vocabulary exercise pending (tomorrow).

**Completed this session:**
- [x] Language name: Smriti (स्मृति), file: `.smr`
- [x] Atomic unit: Sutra (सूत्र), file: `.sut`
- [x] Multi-script: Sanskrit vocabulary, ICU transliteration, any script in source
- [x] Grammar approach: grammar-first (PEG / Tree-sitter)
- [x] Full computation: plant foundation in v0.1 grammar, implement in v0.2
- [x] Renderer: inside toolchain, YAML first, SVG next
- [x] Compilation chain: YAML → SVG → WASM → LLVM/native
- [x] indic-os: Smriti as policy/config/scripting base (systems layer is far future)
- [x] All decisions in ConvoQA.md

---

## TASK (tomorrow): Coin the 29 Sanskrit vocabulary terms

The term needs to precisely name the concept. My suggestions are starting points.

| # | What it does | My suggestion | Your term |
|---|-------------|---------------|-----------|
| **Structural** | | | |
| 1 | Declares a complete process definition (outer container of `.smr`) | smriti (स्मृति) | |
| 2 | Declares a reusable building block (outer container of `.sut`) | sutra (सूत्र) | |
| 3 | A participant — person, org, or system with a role | paksha (पक्ष) | |
| 4 | A right or entitlement a participant holds | adhikara (अधिकार) | |
| 5 | The legal/normative authority backing a right (the citation) | pramana (प्रमाण) | |
| 6 | The owner / author of the process | svami (स्वामी) | |
| 7 | The version of this process | samskara (संस्कार) | |
| 8 | Who can see this process (public / restricted / private) | drishti (दृष्टि) | |
| 9 | How many days before a change takes effect | avadhi (अवधि) | |
| 10 | An external reference to another process or building block | sandarbha (संदर्भ) | |
| 11 | The act of importing and using an external reference | upayoga (उपयोग) | |
| **Flow** | | | |
| 12 | The flow block — sequence, branching, loops | pravah (प्रवाह) | |
| 13 | A single named step within the flow | pada (पद) | |
| 14 | Who performs this step (the actor) | karta (कर्ता) | |
| 15 | What the step does (the action description) | kriya (क्रिया) | |
| 16 | What comes into a step (inputs) | pravesh (प्रवेश) | |
| 17 | What comes out of a step (outputs) | phala (फल) | |
| 18 | Moving forward to the next step | gati (गति) | |
| 19 | Looping back to a previous step | chakra (चक्र) | |
| 20 | A terminal state — process ends here | anta (अन्त) | |
| 21 | A branching point — multiple paths from one step | vibhaga (विभाग) | |
| 22 | The condition evaluated at a branch | niyama (नियम) | |
| **Types** | | | |
| 23 | A whole number | sankhya (संख्या) | |
| 24 | A decimal / fractional number | bhinna (भिन्न) | |
| 25 | A piece of text | vakya (वाक्य) | |
| 26 | A calendar date | tithi (तिथि) | |
| 27 | A span of time (30 days, 2 hours) | antara (अन्तर) | |
| 28 | True or false (boolean) | nischaya (निश्चय) | |
| 29 | A document or file reference | patra (पत्र) | |

**Note on 9 vs 27:** `avadhi` and `antara` both relate to time spans. If you want one word for all durations, they can share a term.

---

## Next session:
- [ ] Lock vocabulary (above task)
- [ ] Decide PEG vs Tree-sitter
- [ ] Create GitHub repo for Sutra
- [ ] Draft formal grammar after vocabulary is locked
