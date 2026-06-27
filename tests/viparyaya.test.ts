import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toYaml } from '../src/backends/yaml.js'
import { toSvg } from '../src/backends/svg.js'
import type { SmritiDecl, PadaDecl } from '../src/ast.js'

function check(src: string) { return typecheck(parse(src)) }
function decl(src: string)  { return check(src).decls[0] as SmritiDecl }
function steps(src: string) { return (decl(src).flow?.items ?? []).filter(i => i.kind === 'pada') as PadaDecl[] }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const WITH_HANDLER = `
smriti test {
  pravah {
    pada submit {
      kaarya: "Submit application"
      nirgama: application-id (vakya)
      viparyaya → submit-failed
    }
    pada submit-failed {
      kaarya: "Log submission failure and notify applicant"
    }
    svasti
    anaapta
  }
}
`

const CHAIN_HANDLERS = `
smriti test {
  pravah {
    pada step-a {
      nirgama: result (tarka)
      viparyaya → error-a
    }
    pada step-b {
      aagama: result (tarka)
      viparyaya → error-b
    }
    pada error-a { kaarya: "Handle A failure" viparyaya → anaapta }
    pada error-b { kaarya: "Handle B failure" viparyaya → anaapta }
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

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('viparyaya — parser', () => {
  it('parses viparyaya → target on a pada', () => {
    const pada = steps(WITH_HANDLER)[0]
    expect(pada.viparyaya).toBe('submit-failed')
  })

  it('leaves viparyaya undefined when not declared', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    const pada = steps(src)[0]
    expect(pada.viparyaya).toBeUndefined()
  })

  it('parses chained handlers — multiple steps each with viparyaya', () => {
    const padas = steps(CHAIN_HANDLERS)
    expect(padas[0].viparyaya).toBe('error-a')
    expect(padas[1].viparyaya).toBe('error-b')
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────────

describe('viparyaya — typechecker', () => {
  it('accepts viparyaya to a declared step', () => {
    expect(() => check(WITH_HANDLER)).not.toThrow()
  })

  it('accepts viparyaya → anaapta (terminal is a valid target)', () => {
    const src = `
smriti t { pravah {
  pada s { viparyaya → anaapta }
  svasti
  anaapta
} }
`
    expect(() => check(src)).not.toThrow()
  })

  it('accepts viparyaya → svasti (unusual but valid)', () => {
    const src = `smriti t { pravah { pada s { viparyaya → svasti } svasti } }`
    expect(() => check(src)).not.toThrow()
  })

  it('rejects viparyaya to a step that does not exist', () => {
    const src = `smriti t { pravah { pada s { viparyaya → ghost } svasti } }`
    expect(() => check(src)).toThrow(/viparyaya target 'ghost' does not exist/)
  })

  it('allows chained handler network — each step has its own failure path', () => {
    expect(() => check(CHAIN_HANDLERS)).not.toThrow()
  })
})

// ─── YAML backend ─────────────────────────────────────────────────────────────

describe('viparyaya — yaml backend', () => {
  it('emits on_error field in the step', () => {
    const yaml = toYaml(decl(WITH_HANDLER))
    expect(yaml).toContain('on_error: submit-failed')
  })

  it('does not emit on_error when viparyaya is absent', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(toYaml(decl(src))).not.toContain('on_error')
  })

  it('on_error → anaapta is emitted literally', () => {
    const src = `smriti t { pravah { pada s { viparyaya → anaapta } svasti anaapta } }`
    expect(toYaml(decl(src))).toContain('on_error: anaapta')
  })
})

// ─── SVG backend ─────────────────────────────────────────────────────────────

describe('viparyaya — svg backend', () => {
  it('includes failure route label in SVG output', () => {
    const svg = toSvg(decl(WITH_HANDLER))
    expect(svg).toContain('submit-failed')
    expect(svg).toContain('fail')
  })

  it('does not include failure route note when absent', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(toSvg(decl(src))).not.toContain('fail →')
  })
})
