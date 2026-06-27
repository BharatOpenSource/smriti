import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'

function check(src: string) { return typecheck(parse(src)) }
function fail(src: string, msg: RegExp) {
  expect(() => check(src)).toThrow(msg)
}
function pass(src: string) {
  expect(() => check(src)).not.toThrow()
}

const wrap = (fields: string) => `
smriti test {
  pravah {
    pada step { nirgama: ${fields} }
    svasti
  }
}
`

// ─── sankhya range parsing ────────────────────────────────────────────────────

describe('sankhya range constraints — parsing', () => {
  it('parses unconstrained sankhya', () => {
    const ast = parse(wrap('count (sankhya)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'sankhya' })
  })

  it('parses sankhya with min and max', () => {
    const ast = parse(wrap('age (sankhya 0..150)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'sankhya', min: 0, max: 150 })
  })

  it('parses sankhya with min only', () => {
    const ast = parse(wrap('score (sankhya 1..)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'sankhya', min: 1 })
  })

  it('parses sankhya with max only', () => {
    const ast = parse(wrap('percentage (sankhya ..100)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'sankhya', max: 100 })
  })

  it('parses zero as a valid min bound', () => {
    const ast = parse(wrap('amount (sankhya 0..1000000)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'sankhya', min: 0, max: 1000000 })
  })
})

// ─── sankhya range typechecking ───────────────────────────────────────────────

describe('sankhya range constraints — typechecking', () => {
  it('accepts valid min..max range', () => {
    pass(wrap('amount (sankhya 0..100)'))
  })

  it('accepts min-only range', () => {
    pass(wrap('count (sankhya 1..)'))
  })

  it('accepts max-only range', () => {
    pass(wrap('pct (sankhya ..100)'))
  })

  it('accepts equal min and max', () => {
    pass(wrap('exact (sankhya 5..5)'))
  })

  it('rejects min greater than max', () => {
    fail(wrap('bad (sankhya 100..0)'), /min \(100\) must not exceed max \(0\)/)
  })
})

// ─── vakya pattern parsing ───────────────────────────────────────────────────

describe('vakya pattern constraints — parsing', () => {
  it('parses unconstrained vakya', () => {
    const ast = parse(wrap('name (vakya)'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'vakya' })
  })

  it('parses vakya with regex pattern', () => {
    const ast = parse(wrap('gstin (vakya "[A-Z0-9]{15}")'))
    const field = (ast.decls[0] as any).flow.items[0].nirgama[0]
    expect(field.type).toEqual({ kind: 'vakya', pattern: '[A-Z0-9]{15}' })
  })
})

// ─── vakya pattern typechecking ──────────────────────────────────────────────

describe('vakya pattern constraints — typechecking', () => {
  it('accepts a valid regex pattern', () => {
    pass(wrap('gstin (vakya "^[A-Z]{5}[0-9]{4}[A-Z]{1}$")'))
  })

  it('accepts unconstrained vakya', () => {
    pass(wrap('remarks (vakya)'))
  })

  it('rejects an invalid regex pattern', () => {
    fail(wrap('bad (vakya "[unclosed")'), /not a valid regular expression/)
  })
})

// ─── constraints in context ───────────────────────────────────────────────────

describe('constraints in full process context', () => {
  it('accepts constrained fields in aagama and nirgama on pada', () => {
    pass(`
smriti kyc-check {
  aagama: age (sankhya 18..120), gstin (vakya "[A-Z0-9]{15}")
  pravah {
    pada verify {
      aagama:  age (sankhya 18..120), gstin (vakya "[A-Z0-9]{15}")
      nirgama: score (sankhya 0..1000)
    }
    svasti
  }
}
`)
  })

  it('accepts constrained fields at smriti level', () => {
    pass(`
smriti tax-filing {
  aagama:  tax-year (sankhya 2000..2100), pan (vakya "[A-Z]{5}[0-9]{4}[A-Z]{1}")
  nirgama: refund-amount (sankhya 0..)
  pravah { svasti }
}
`)
  })

  it('type compatibility: constrained and unconstrained sankhya are the same type', () => {
    pass(`
smriti test {
  pravah {
    pada produce { nirgama: count (sankhya 0..100) }
    pada consume { aagama:  count (sankhya) }
    svasti
  }
}
`)
  })
})
