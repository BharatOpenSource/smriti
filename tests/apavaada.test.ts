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
      apavaada → submit-failed
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
      apavaada → error-a
    }
    pada step-b {
      aagama: result (tarka)
      apavaada → error-b
    }
    pada error-a { kaarya: "Handle A failure" apavaada → anaapta }
    pada error-b { kaarya: "Handle B failure" apavaada → anaapta }
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

describe('apavaada — parser', () => {
  it('parses apavaada → target on a pada', () => {
    const pada = steps(WITH_HANDLER)[0]
    expect(pada.apavaada).toBe('submit-failed')
  })

  it('leaves apavaada undefined when not declared', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    const pada = steps(src)[0]
    expect(pada.apavaada).toBeUndefined()
  })

  it('parses chained handlers — multiple steps each with apavaada', () => {
    const padas = steps(CHAIN_HANDLERS)
    expect(padas[0].apavaada).toBe('error-a')
    expect(padas[1].apavaada).toBe('error-b')
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────────

describe('apavaada — typechecker', () => {
  it('accepts apavaada to a declared step', () => {
    expect(() => check(WITH_HANDLER)).not.toThrow()
  })

  it('accepts apavaada → anaapta (terminal is a valid target)', () => {
    const src = `
smriti t { pravah {
  pada s { apavaada → anaapta }
  svasti
  anaapta
} }
`
    expect(() => check(src)).not.toThrow()
  })

  it('accepts apavaada → svasti (unusual but valid)', () => {
    const src = `smriti t { pravah { pada s { apavaada → svasti } svasti } }`
    expect(() => check(src)).not.toThrow()
  })

  it('rejects apavaada to a step that does not exist', () => {
    const src = `smriti t { pravah { pada s { apavaada → ghost } svasti } }`
    expect(() => check(src)).toThrow(/apavaada target 'ghost' does not exist/)
  })

  it('allows chained handler network — each step has its own failure path', () => {
    expect(() => check(CHAIN_HANDLERS)).not.toThrow()
  })
})

// ─── YAML backend ─────────────────────────────────────────────────────────────

describe('apavaada — yaml backend', () => {
  it('emits on_error field in the step', () => {
    const yaml = toYaml(decl(WITH_HANDLER))
    expect(yaml).toContain('on_error: submit-failed')
  })

  it('does not emit on_error when apavaada is absent', () => {
    const src = `smriti t { pravah { pada s { kaarya: "x" } svasti } }`
    expect(toYaml(decl(src))).not.toContain('on_error')
  })

  it('on_error → anaapta is emitted literally', () => {
    const src = `smriti t { pravah { pada s { apavaada → anaapta } svasti anaapta } }`
    expect(toYaml(decl(src))).toContain('on_error: anaapta')
  })
})

// ─── Cross-step aagama coverage ──────────────────────────────────────────────

describe('apavaada — handler coverage', () => {
  it('accepts handler that declares all apavaadaNirgama fields', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: error-code (vakya), reason (vakya)
            apavaada → handle-error
          }
          pada handle-error {
            aagama: error-code (vakya), reason (vakya)
            kaarya: "Handle error"
          }
          svasti
          anaapta
        }
      }
    `)).not.toThrow()
  })

  it('rejects handler missing a declared apavaada field', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: error-code (vakya), reason (vakya)
            apavaada → handle-error
          }
          pada handle-error {
            aagama: error-code (vakya)
            kaarya: "Handle error"
          }
          svasti
          anaapta
        }
      }
    `)).toThrow(/does not declare field 'reason'/)
  })

  it('rejects handler with type mismatch on apavaada field', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: error-code (sankhya)
            apavaada → handle-error
          }
          pada handle-error {
            aagama: error-code (vakya)
            kaarya: "Handle error"
          }
          svasti
          anaapta
        }
      }
    `)).toThrow(/declares 'error-code' as vakya but 'submit' apavaada produces it as sankhya/)
  })

  it('allows handler with more aagama than produced — no missing field error', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: error-code (vakya)
            apavaada → handle-error
          }
          pada handle-error {
            aagama: error-code (vakya), extra (vakya)
            kaarya: "Handle error"
          }
          svasti
          anaapta
        }
      }
    `)).not.toThrow()
  })

  it('skips coverage check when apavaada routes to a terminal', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: error-code (vakya)
            apavaada → anaapta
          }
          svasti
          anaapta
        }
      }
    `)).not.toThrow()
  })

  it('handles multiple apavaada fields — all must be covered', () => {
    expect(() => check(`
      smriti t {
        pravah {
          pada submit {
            apavaada: code (vakya), msg (vakya), retryable (tarka)
            apavaada → on-error
          }
          pada on-error {
            aagama: code (vakya), msg (vakya)
            kaarya: "Handle"
          }
          svasti
          anaapta
        }
      }
    `)).toThrow(/does not declare field 'retryable'/)
  })
})

// ─── SVG backend ─────────────────────────────────────────────────────────────

describe('apavaada — svg backend', () => {
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
