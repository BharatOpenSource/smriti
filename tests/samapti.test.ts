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

const WITH_TIMEOUT = `
smriti test {
  pravah {
    pada verify {
      kaarya: "Verify documents"
      samaya: 14 antara
      samapti → escalate
    }
    pada escalate {
      kaarya: "Escalate to supervisor"
      apavaada → anaapta
    }
    svasti
    anaapta
  }
}
`

const BOTH_PATHS = `
smriti test {
  pravah {
    pada process {
      kaarya: "Process application"
      samaya: 7 antara
      apavaada → process-failed
      samapti  → process-timed-out
    }
    pada process-failed    { kaarya: "Log failure" }
    pada process-timed-out { kaarya: "Notify SLA breach and escalate" }
    svasti
    anaapta
  }
}
`

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('samapti — parser', () => {
  it('parses samapti → target on a pada', () => {
    const pada = steps(WITH_TIMEOUT)[0]
    expect(pada.samapti).toBe('escalate')
  })

  it('leaves samapti undefined when not declared', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(steps(src)[0].samapti).toBeUndefined()
  })

  it('parses both apavaada and samapti on the same step', () => {
    const pada = steps(BOTH_PATHS)[0]
    expect(pada.apavaada).toBe('process-failed')
    expect(pada.samapti).toBe('process-timed-out')
  })

  it('accepts samapti → anaapta (terminal target)', () => {
    const src = `smriti t { pravah { pada s { samaya: 1 antara samapti → anaapta } svasti anaapta } }`
    const pada = steps(src)[0]
    expect(pada.samapti).toBe('anaapta')
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────────

describe('samapti — typechecker', () => {
  it('accepts samapti with samaya declared', () => {
    expect(() => check(WITH_TIMEOUT)).not.toThrow()
  })

  it('rejects samapti without samaya — timeout routing requires a time limit', () => {
    const src = `smriti t { pravah { pada s { samapti → escalate } pada escalate { kaarya: "x" } svasti } }`
    expect(() => check(src)).toThrow(/no samaya \(SLA\) is set/)
  })

  it('rejects samapti target that does not exist in the flow', () => {
    const src = `smriti t { pravah { pada s { samaya: 1 antara samapti → ghost } svasti } }`
    expect(() => check(src)).toThrow(/samapti target 'ghost' does not exist/)
  })

  it('accepts samapti → svasti', () => {
    const src = `smriti t { pravah { pada s { samaya: 1 antara samapti → svasti } svasti } }`
    expect(() => check(src)).not.toThrow()
  })

  it('accepts both apavaada and samapti on the same step', () => {
    expect(() => check(BOTH_PATHS)).not.toThrow()
  })
})

// ─── YAML backend ─────────────────────────────────────────────────────────────

describe('samapti — yaml backend', () => {
  it('emits on_timeout field on the step', () => {
    expect(toYaml(decl(WITH_TIMEOUT))).toContain('on_timeout: escalate')
  })

  it('does not emit on_timeout when samapti is absent', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(toYaml(decl(src))).not.toContain('on_timeout')
  })

  it('emits both on_error and on_timeout when both paths declared', () => {
    const yaml = toYaml(decl(BOTH_PATHS))
    expect(yaml).toContain('on_error: process-failed')
    expect(yaml).toContain('on_timeout: process-timed-out')
  })
})

// ─── SVG backend ─────────────────────────────────────────────────────────────

describe('samapti — svg backend', () => {
  it('shows timeout route in SVG output', () => {
    const svg = toSvg(decl(WITH_TIMEOUT))
    expect(svg).toContain('escalate')
    expect(svg).toContain('timeout')
  })

  it('does not include timeout note when absent', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(toSvg(decl(src))).not.toContain('timeout')
  })
})
