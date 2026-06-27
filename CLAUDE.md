# Smriti — Claude Instructions

> Read this before doing any work in this directory.
> Org context: see `../CLAUDE.md`.

## What this project is

**Smriti (स्मृति)** is a formal language for expressing processes, rules, and systems — readable, auditable, formally defined. File extension: `.smr`.

**Sutra (सूत्र)** is the reusable building block unit within Smriti. File extension: `.sut`. Sutra is also the name of the toolchain (parser, compiler, LSP, renderers) that processes both file types.

**The goal:** A clean, precise language with a formal grammar that makes process definitions unambiguous and toolable. Designed to be read by non-technical people after 10 minutes, written by developers and power users, parsed by machines.

**Relationship to pravaaha:** Smriti is the language; pravaaha is the platform. pravaaha v0.1 uses YAML. Smriti becomes the source format in pravaaha v0.2+. The YAML schema is a compilation target, not the source.

## Design principles

1. **Formally defined** — a grammar that is unambiguous. Every valid process has exactly one parse.
2. **Human-readable** — a non-technical person can read a process definition and understand it
3. **Indic-language aware** — designed from the start to support Indic scripts as a rendering target
4. **Composable** — processes can reference other processes; steps can be reused
5. **Minimal** — every keyword earns its place

## Current status

**Language design complete. Vocabulary locked. Grammar next.**

- Names locked: Smriti (language), Sutra (reusable unit + toolchain)
- Vocabulary locked: 47 Sanskrit terms across structural, flow, data, and type categories (see `docs/ConvoQA.md`)
- Next: PEG vs Tree-sitter decision, then formal grammar draft

## Session start checklist

Before doing anything else each session:
1. Read `docs/ConvoQA.md` — past decisions and open questions
2. Read `docs/lessons.md` — mistakes and rules to avoid repeating
3. Read `docs/LatestTask.md` — what was being worked on last session

## Working conventions

- **200-line limit** on all markdown files in `docs/`
- **LatestTask.md** — rolling session log, current 1-2 sessions only
- **ConvoQA.md** — any decision made in conversation
- **lessons.md** — updated after any correction, reviewed at session start
- **Feature branches:** `feature/<short-description>` — never commit to main directly

## Git

Repo: https://github.com/BharatOpenSource/smriti
Branch convention: `feature/<short-description>`
