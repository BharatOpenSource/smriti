import { describe, it, expect, beforeAll } from 'vitest'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports, RegistryResolver, parseRegistryUri, registryCachePath } from '../src/resolver.js'

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

  it('throws on invalid registry URI format with format hint', () => {
    const src = `
smriti test {
  sangama gov { yuja: "gov-india/participants" }
  pravah { svasti }
}
`
    const ast = parse(src)
    expect(() => resolveImports(ast, join(TEMP, 'main.smr')))
      .toThrow(/Invalid registry URI/)
  })

  it('throws cache-miss error with smr fetch hint when URI is valid but not cached', () => {
    const src = `
smriti test {
  sangama gov { yuja: "gov-india/participants@1.0.0" }
  pravah { svasti }
}
`
    const ast = parse(src)
    // Use a resolver with a fresh empty cache root so we know it's a miss.
    const emptyCache = join(TEMP, 'empty-cache')
    const resolver = new RegistryResolver(emptyCache)
    expect(() => resolveImports(ast, join(TEMP, 'main.smr'), resolver))
      .toThrow(/smr fetch gov-india\/participants@1\.0\.0/)
  })
})

describe('registry resolver — parseRegistryUri', () => {
  it('parses a valid org/name@version URI', () => {
    const r = parseRegistryUri('BharatOpenSource/gst-refund@1.0.0')
    expect(r).toEqual({ org: 'BharatOpenSource', name: 'gst-refund', version: '1.0.0' })
  })

  it('accepts hyphens and underscores in org and name', () => {
    const r = parseRegistryUri('gov-india/pan_verification@2.1.3')
    expect(r).toEqual({ org: 'gov-india', name: 'pan_verification', version: '2.1.3' })
  })

  it('rejects URI missing version', () => {
    expect(() => parseRegistryUri('org/name'))
      .toThrow(/Invalid registry URI/)
  })

  it('rejects URI missing org/name separator', () => {
    expect(() => parseRegistryUri('justname@1.0.0'))
      .toThrow(/Invalid registry URI/)
  })

  it('rejects relative path as registry URI', () => {
    expect(() => parseRegistryUri('./file.smr'))
      .toThrow(/Invalid registry URI/)
  })

  it('rejects version with only two parts', () => {
    expect(() => parseRegistryUri('org/name@1.0'))
      .toThrow(/Invalid registry URI/)
  })
})

describe('registry resolver — cache', () => {
  const CACHE_ROOT = join(TEMP, 'test-registry')

  const MINIMAL_SMR = `
smriti cached-process {
  paksha agent { bhumika: worker adhikara: act }
  pravah { svasti }
}
`

  beforeAll(() => {
    // Manually prime the cache for the hit test.
    const uri = parseRegistryUri('test-org/cached-process@1.0.0')
    mkdirSync(join(CACHE_ROOT, uri.org, uri.name), { recursive: true })
    writeFileSync(registryCachePath(uri, CACHE_ROOT), MINIMAL_SMR, 'utf8')
  })

  it('loads from cache when the file exists', () => {
    const src = `
smriti main {
  sangama lib { yuja: "test-org/cached-process@1.0.0" }
  pravah { svasti }
}
`
    const ast = parse(src)
    const resolver = new RegistryResolver(CACHE_ROOT)
    const context = resolveImports(ast, join(TEMP, 'main.smr'), resolver)
    expect(context.imports.has('lib')).toBe(true)
    expect(context.imports.get('lib')!.participants.map(p => p.name)).toContain('agent')
  })

  it('cache-miss error includes the expected cache path', () => {
    const uri = 'test-org/missing-process@9.9.9'
    const src = `
smriti main {
  sangama lib { yuja: "${uri}" }
  pravah { svasti }
}
`
    const ast = parse(src)
    const resolver = new RegistryResolver(CACHE_ROOT)
    const err = (() => {
      try { resolveImports(ast, join(TEMP, 'main.smr'), resolver) }
      catch (e) { return String(e) }
      return ''
    })()
    expect(err).toMatch(/not in local cache/)
    expect(err).toMatch(/smr fetch/)
    expect(err).toMatch(/test-org/)
    expect(err).toMatch(/missing-process/)
    expect(err).toMatch(/9\.9\.9\.smr/)
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
