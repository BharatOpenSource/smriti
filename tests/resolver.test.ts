import { describe, it, expect, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports, RegistryResolver } from '../src/resolver.js'

// ─── Temp file setup ──────────────────────────────────────────────────────────

const TEMP = join(tmpdir(), `smriti-resolver-test-${process.pid}`)

beforeAll(() => {
  mkdirSync(TEMP, { recursive: true })

  writeFileSync(join(TEMP, 'participants.smr'), `
smriti gov-participants {
  adhipati: "Government of India"
  paksha citizen  { bhumika: individual  adhikara: apply }
  paksha ministry { bhumika: authority   adhikara: approve }
  paksha uidai    { bhumika: verifier    adhikara: verify }
}
`)

  writeFileSync(join(TEMP, 'circular-a.smr'), `
smriti circular-a {
  sangama b { yuja: "./circular-b.smr" }
  pravah { svasti }
}
`)

  writeFileSync(join(TEMP, 'circular-b.smr'), `
smriti circular-b {
  sangama a { yuja: "./circular-a.smr" }
  pravah { svasti }
}
`)

  writeFileSync(join(TEMP, 'diamond-base.smr'), `
smriti base-participants {
  paksha admin { bhumika: administrator adhikara: manage }
}
`)
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAIN_USING_PARTICIPANTS = `
smriti passport-renewal {
  sangama gov { yuja: "./participants.smr" }

  pravah {
    pada submit {
      karta: gov.citizen
      kaarya: "Submit renewal application"
      nirgama: result (tarka)
    }
    vibhaga result {
      niyama satya    → svasti
      niyama asatya   → anaapta
      niyama avyakta  → anaapta
    }
    svasti
    anaapta
  }
}
`

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('resolver — import loading', () => {
  it('resolves a sangama reference and exposes imported participants', () => {
    const ast = parse(MAIN_USING_PARTICIPANTS)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    expect(context.imports.has('gov')).toBe(true)
    const ns = context.imports.get('gov')!
    expect(ns.participants.map(p => p.name)).toContain('citizen')
    expect(ns.participants.map(p => p.name)).toContain('ministry')
    expect(ns.participants.map(p => p.name)).toContain('uidai')
  })

  it('passes typecheck when karta uses a valid qualified name', () => {
    const ast = parse(MAIN_USING_PARTICIPANTS)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    expect(() => typecheck(ast, context)).not.toThrow()
  })

  it('fails typecheck when karta namespace is not imported', () => {
    const src = `
smriti bad {
  pravah {
    pada step { karta: unknown-ns.citizen }
    svasti
  }
}
`
    const ast = parse(src)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    expect(() => typecheck(ast, context)).toThrow(/namespace 'unknown-ns' is not imported/)
  })

  it('fails typecheck when qualified participant does not exist in namespace', () => {
    const src = `
smriti bad {
  sangama gov { yuja: "./participants.smr" }
  pravah {
    pada step { karta: gov.ghost-participant }
    svasti
  }
}
`
    const ast = parse(src)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    expect(() => typecheck(ast, context)).toThrow(/gov\.ghost-participant/)
  })

  it('provides available participant names in the error message', () => {
    const src = `
smriti bad {
  sangama gov { yuja: "./participants.smr" }
  pravah {
    pada step { karta: gov.nobody }
    svasti
  }
}
`
    const ast = parse(src)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    const err = (() => { try { typecheck(ast, context) } catch (e) { return String(e) } return '' })()
    expect(err).toMatch(/gov\.citizen/)
    expect(err).toMatch(/gov\.ministry/)
  })
})

describe('resolver — error cases', () => {
  it('throws on circular imports', () => {
    const circA = parse(`
smriti circular-a {
  sangama b { yuja: "./circular-b.smr" }
  pravah { svasti }
}
`)
    expect(() => resolveImports(circA, join(TEMP, 'circular-a.smr')))
      .toThrow(/[Cc]ircular/)
  })

  it('throws on missing file', () => {
    const src = `
smriti test {
  sangama missing { yuja: "./does-not-exist.smr" }
  pravah { svasti }
}
`
    const ast = parse(src)
    expect(() => resolveImports(ast, join(TEMP, 'main.smr')))
      .toThrow(/Cannot read import/)
  })

  it('throws on registry-style yuja with helpful message', () => {
    const src = `
smriti test {
  sangama gov { yuja: "gov-india/participants@1.0" }
  pravah { svasti }
}
`
    const ast = parse(src)
    expect(() => resolveImports(ast, join(TEMP, 'main.smr')))
      .toThrow(/Registry imports not yet supported/)
  })
})

describe('resolver — namespacing', () => {
  it('stores imported participants under their namespace, not merged flat', () => {
    const ast = parse(MAIN_USING_PARTICIPANTS)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    // Imported under 'gov' namespace — not directly in any other namespace
    expect(context.imports.has('gov')).toBe(true)
    expect(context.imports.has('citizen')).toBe(false)
  })

  it('supports two namespaces from two different imports', () => {
    const src = `
smriti dual-import {
  sangama gov  { yuja: "./participants.smr" }
  sangama base { yuja: "./diamond-base.smr" }
  pravah { svasti }
}
`
    const ast = parse(src)
    const context = resolveImports(ast, join(TEMP, 'main.smr'))
    expect(context.imports.has('gov')).toBe(true)
    expect(context.imports.has('base')).toBe(true)
    expect(context.imports.get('gov')!.participants.map(p => p.name)).toContain('citizen')
    expect(context.imports.get('base')!.participants.map(p => p.name)).toContain('admin')
  })
})
