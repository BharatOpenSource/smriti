import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports } from '../src/resolver.js'

function check(src: string) {
  const ast = parse(src)
  return typecheck(ast, resolveImports(ast, '/test/file.smr'))
}

const BASE = `
smriti test {
  adhipati: "Test"
  aavartana: 1.0.0
  stara: public
  aagama: amount (sankhya), tag (vakya)
  pravah {
    pada step-one { kaarya: "a" nirgama: score (sankhya) }
    BODY
    svasti
  }
}
`

function flow(body: string) { return BASE.replace('BODY', body) }

// ─── varna parsing ────────────────────────────────────────────────────────────

describe('varna parsing', () => {
  it('parses a plain varna declaration (no expression)', () => {
    const ast = parse(flow('varna result : tarka'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const v = smr.flow.items[1]
    expect(v.kind).toBe('varna')
    if (v.kind !== 'varna') return
    expect(v.name).toBe('result')
    expect(v.varnaType).toEqual({ kind: 'tarka' })
    expect(v.expr).toBeUndefined()
  })

  it('parses a varna with computed expression', () => {
    const ast = parse(flow('varna is-valid : tarka = amount > 0'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const v = smr.flow.items[1]
    expect(v.kind).toBe('varna')
    if (v.kind !== 'varna') return
    expect(v.expr?.kind).toBe('compare')
  })

  it('parses varna with sankhya type and constraint', () => {
    const ast = parse(flow('varna bounded : sankhya 0..100'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const v = smr.flow.items[1]
    if (v.kind !== 'varna') return
    expect(v.varnaType).toEqual({ kind: 'sankhya', min: 0, max: 100 })
  })

  it('parses varna with vakya type', () => {
    const ast = parse(flow('varna label : vakya'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const v = smr.flow.items[1]
    if (v.kind !== 'varna') return
    expect(v.varnaType.kind).toBe('vakya')
  })
})

// ─── varna typechecking ───────────────────────────────────────────────────────

describe('varna typechecking', () => {
  it('accepts valid varna with expression', () => {
    expect(() => check(flow('varna is-valid : tarka = amount > 0'))).not.toThrow()
  })

  it('accepts varna without expression', () => {
    expect(() => check(flow('varna label : vakya'))).not.toThrow()
  })

  it('rejects varna with invalid sankhya constraint', () => {
    expect(() => check(flow('varna bad : sankhya 100..0'))).toThrow(/min.*must not exceed max/)
  })

  it('produces varna field for downstream vibhaga', () => {
    const src = flow(`
varna is-valid : tarka = amount > 0
vibhaga is-valid {
  niyama satya → svasti
  niyama asatya → anaapta
  niyama avyakta → anaapta
}`)
    expect(() => check(src)).not.toThrow()
  })
})

// ─── krama/kosa constraints ────────────────────────────────────────────────────

describe('krama/kosa constraints (collection inner types)', () => {
  function withField(field: string) {
    return `
smriti test {
  adhipati: "Test"
  aavartana: 1.0.0
  stara: public
  aagama: items (${field})
  pravah { pada a { kaarya: "a" } svasti }
}
`
  }

  it('parses krama[sankhya 0..100]', () => {
    const ast = parse(withField('krama[sankhya 0..100]'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.aagama) return
    const f = smr.aagama[0]
    expect(f.type.kind).toBe('krama')
    if (f.type.kind !== 'krama') return
    expect(f.type.of).toEqual({ kind: 'sankhya', min: 0, max: 100 })
  })

  it('accepts krama[sankhya 0..100] through typechecker', () => {
    expect(() => check(withField('krama[sankhya 0..100]'))).not.toThrow()
  })

  it('rejects krama[sankhya 100..0] — inner constraint invalid', () => {
    expect(() => check(withField('krama[sankhya 100..0]'))).toThrow(/min.*must not exceed max/)
  })

  it('parses kosa[vakya, sankhya 0..1000]', () => {
    const ast = parse(withField('kosa[vakya, sankhya 0..1000]'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.aagama) return
    const f = smr.aagama[0]
    expect(f.type.kind).toBe('kosa')
    if (f.type.kind !== 'kosa') return
    expect(f.type.value).toEqual({ kind: 'sankhya', min: 0, max: 1000 })
  })

  it('accepts kosa[vakya, sankhya 0..1000] through typechecker', () => {
    expect(() => check(withField('kosa[vakya, sankhya 0..1000]'))).not.toThrow()
  })

  it('rejects kosa[krama[vakya], tarka] — collection key not allowed', () => {
    expect(() => check(withField('kosa[krama[vakya], tarka]'))).toThrow(/kosa key type must be a scalar/)
  })

  it('parses krama[vakya "[A-Z]+"]', () => {
    const ast = parse(withField('krama[vakya "[A-Z]+"]'))
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.aagama) return
    const f = smr.aagama[0]
    if (f.type.kind !== 'krama') return
    expect(f.type.of).toEqual({ kind: 'vakya', pattern: '[A-Z]+' })
  })

  it('rejects krama[vakya "([invalid"]', () => {
    expect(() => check(withField('krama[vakya "([invalid"]'))).toThrow(/not a valid regular expression/)
  })
})

// ─── apavaada/samapti error data ──────────────────────────────────────────────

describe('per-step error data (apavaada/samapti nirgama)', () => {
  function padaWithError(body: string) {
    return `
smriti test {
  adhipati: "Test"
  aavartana: 1.0.0
  stara: public
  pravah {
    pada compute {
      kaarya: "compute"
      ${body}
    }
    pada handle-error { kaarya: "handle" aagama: error-code (vakya) }
    pada handle-timeout { kaarya: "timeout" aagama: elapsed (antara) }
    svasti
    anaapta
  }
}
`
  }

  it('parses apavaada with error data fields', () => {
    const src = padaWithError(`
      apavaada → handle-error
      apavaada: error-code (vakya)
    `)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const step = smr.flow.items[0]
    if (step.kind !== 'pada') return
    expect(step.apavaada).toBe('handle-error')
    expect(step.apavaadaNirgama).toHaveLength(1)
    expect(step.apavaadaNirgama![0].name).toBe('error-code')
  })

  it('accepts apavaada with error data through typechecker', () => {
    const src = padaWithError(`
      apavaada → handle-error
      apavaada: error-code (vakya)
    `)
    expect(() => check(src)).not.toThrow()
  })

  it('rejects apavaada data without apavaada routing', () => {
    const src = padaWithError(`apavaada: error-code (vakya)`)
    expect(() => check(src)).toThrow(/apavaada data declared.*no apavaada routing/)
  })

  it('parses samapti with timeout data fields', () => {
    const src = padaWithError(`
      samaya: 30 antara
      samapti → handle-timeout
      samapti: elapsed (antara)
    `)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const step = smr.flow.items[0]
    if (step.kind !== 'pada') return
    expect(step.samapti).toBe('handle-timeout')
    expect(step.samaptiNirgama).toHaveLength(1)
    expect(step.samaptiNirgama![0].name).toBe('elapsed')
  })

  it('accepts samapti with timeout data through typechecker', () => {
    const src = padaWithError(`
      samaya: 30 antara
      samapti → handle-timeout
      samapti: elapsed (antara)
    `)
    expect(() => check(src)).not.toThrow()
  })

  it('rejects samapti data without samapti routing', () => {
    const src = padaWithError(`samapti: elapsed (antara)`)
    expect(() => check(src)).toThrow(/samapti data declared.*no samapti routing/)
  })

  it('accepts multiple error data fields', () => {
    const src = `
smriti test {
  adhipati: "Test"
  aavartana: 1.0.0
  stara: public
  pravah {
    pada compute {
      kaarya: "compute"
      apavaada → on-fail
      apavaada: error-code (vakya), reason (vakya), attempt (sankhya)
    }
    pada on-fail { kaarya: "handle" aagama: error-code (vakya), reason (vakya), attempt (sankhya) }
    svasti
    anaapta
  }
}
`
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.flow) return
    const step = smr.flow.items[0]
    if (step.kind !== 'pada') return
    expect(step.apavaadaNirgama).toHaveLength(3)
  })
})
