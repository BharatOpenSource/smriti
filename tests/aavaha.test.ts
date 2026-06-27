import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toYaml } from '../src/backends/yaml.js'
import { toSvg } from '../src/backends/svg.js'
import type { SmritiDecl, AavahaDecl } from '../src/ast.js'
import type { ResolveContext } from '../src/resolver.js'

function check(src: string, context?: ResolveContext) { return typecheck(parse(src), context) }
function decl(src: string, context?: ResolveContext) { return check(src, context).decls[0] as SmritiDecl }
function aavahas(src: string) {
  return (parse(src).decls[0] as SmritiDecl).flow?.items.filter(i => i.kind === 'aavaha') as AavahaDecl[]
}

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('aavaha — parser', () => {
  it('parses bare identifier target', () => {
    const src = `smriti t { pravah { aavaha pan-check svasti } }`
    const [a] = aavahas(src)
    expect(a.target).toBe('pan-check')
  })

  it('parses qualified name target — namespace.process', () => {
    const src = `smriti t { pravah { aavaha gov.pan-verification svasti } }`
    const [a] = aavahas(src)
    expect(a.target).toEqual({ namespace: 'gov', name: 'pan-verification' })
  })

  it('parses aavaha with aagama and nirgama', () => {
    const src = `
smriti t { pravah {
  aavaha gov.pan-verification
    aagama: pan-number (vakya)
    nirgama: verified (tarka)
  svasti
} }
`
    const [a] = aavahas(src)
    expect(a.target).toEqual({ namespace: 'gov', name: 'pan-verification' })
    expect(a.aagama[0].name).toBe('pan-number')
    expect(a.nirgama[0].name).toBe('verified')
  })
})

// ─── Typechecker ─────────────────────────────────────────────────────────────

describe('aavaha — typechecker', () => {
  it('accepts bare identifier target without a resolver context', () => {
    const src = `smriti t { pravah { aavaha local-step svasti } }`
    expect(() => check(src)).not.toThrow()
  })

  it('accepts qualified target when namespace is in context', () => {
    const src = `smriti t { pravah { aavaha gov.pan-verification svasti } }`
    const context: ResolveContext = {
      imports: new Map([['gov', { namespace: 'gov', participants: [] }]]),
    }
    expect(() => check(src, context)).not.toThrow()
  })

  it('rejects qualified target when namespace is not imported', () => {
    const src = `smriti t { pravah { aavaha gov.pan-verification svasti } }`
    expect(() => check(src)).toThrow(/aavaha namespace 'gov' is not imported/)
  })

  it('error message includes sangama hint', () => {
    const src = `smriti t { pravah { aavaha ministry.process svasti } }`
    expect(() => check(src)).toThrow(/sangama ministry/)
  })
})

// ─── YAML backend ─────────────────────────────────────────────────────────────

describe('aavaha — yaml backend', () => {
  it('emits invoke field with bare name', () => {
    const src = `smriti t { pravah { aavaha pan-check svasti } }`
    expect(toYaml(decl(src))).toContain('invoke: pan-check')
  })

  it('emits invoke field with qualified name', () => {
    const src = `smriti t { pravah { aavaha gov.pan-verification svasti } }`
    const context: ResolveContext = {
      imports: new Map([['gov', { namespace: 'gov', participants: [] }]]),
    }
    expect(toYaml(decl(src, context))).toContain('invoke: gov.pan-verification')
  })

  it('emits inputs and outputs on aavaha step', () => {
    const src = `smriti t { pravah {
      aavaha gov.pan-verification
        aagama: pan-number (vakya)
        nirgama: verified (tarka)
      svasti
    } }`
    const context: ResolveContext = {
      imports: new Map([['gov', { namespace: 'gov', participants: [] }]]),
    }
    const yaml = toYaml(decl(src, context))
    expect(yaml).toContain('inputs:')
    expect(yaml).toContain('outputs:')
  })
})

// ─── SVG backend ─────────────────────────────────────────────────────────────

describe('aavaha — svg backend', () => {
  it('renders aavaha as an invocation box in SVG', () => {
    const src = `smriti t { pravah { aavaha gov.pan-verification svasti } }`
    const context: ResolveContext = {
      imports: new Map([['gov', { namespace: 'gov', participants: [] }]]),
    }
    const svg = toSvg(decl(src, context))
    expect(svg).toContain('gov.pan-verification')
  })
})
