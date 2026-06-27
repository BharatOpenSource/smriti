import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports } from '../src/resolver.js'
import { evaluate, toTarka, evaluateGhatana, type Payload } from '../src/evaluator.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function check(src: string) {
  const ast = parse(src)
  return typecheck(ast, resolveImports(ast, '/test/file.smr'))
}

function smrWithGhatana(ghatanaBody: string, aagamaLine = 'aagama: amount (sankhya), tag (vakya)') {
  return `
smriti test-process {
  adhipati: "Test"
  aavartana: 1.0.0
  stara: public

  ${aagamaLine}

  ${ghatanaBody}

  pravah {
    pada step-one {
      kaarya: "do thing"
    }
    svasti
  }
}
`
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

describe('ghatana parsing', () => {
  it('parses vrtti as compare expression', () => {
    const src = smrWithGhatana(`ghatana { vrtti: amount > 0 }`)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.kind).toBe('ghatana')
    expect(smr.trigger?.vrtti?.kind).toBe('compare')
  })

  it('parses vrtti as logical expression', () => {
    const src = smrWithGhatana(`ghatana { vrtti: amount > 0 && tag != "" }`)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.vrtti?.kind).toBe('logical')
  })

  it('parses hetu with prati', () => {
    const src = smrWithGhatana(`ghatana { hetu: prati 30 antara }`)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.hetu?.kind).toBe('hetu-schedule')
    expect(smr.trigger?.hetu?.quantity).toBe(30)
    expect(smr.trigger?.hetu?.unit).toBe('antara')
  })

  it('parses all five fields together', () => {
    const src = smrWithGhatana(`
      ghatana {
        vrtti:  amount > 100
        hetu:   prati 1 submission
        karta:  "system"
        sthala: "portal"
        kaarya: "trigger refund"
      }
    `)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.vrtti?.kind).toBe('compare')
    expect(smr.trigger?.hetu?.quantity).toBe(1)
    expect(smr.trigger?.karta?.kind).toBe('string-literal')
    expect(smr.trigger?.sthala?.kind).toBe('string-literal')
    expect(smr.trigger?.kaarya?.kind).toBe('string-literal')
  })

  it('parses ghatana with no vrtti (unconditional)', () => {
    const src = smrWithGhatana(`ghatana { hetu: prati 1 day }`)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.vrtti).toBeUndefined()
    expect(smr.trigger?.hetu?.unit).toBe('day')
  })
})

// ─── Typechecking ─────────────────────────────────────────────────────────────

describe('ghatana typechecking', () => {
  it('accepts vrtti referencing aagama fields', () => {
    expect(() => check(smrWithGhatana(`ghatana { vrtti: amount > 0 }`))).not.toThrow()
  })

  it('rejects vrtti referencing unknown identifier', () => {
    expect(() => check(smrWithGhatana(`ghatana { vrtti: unknown-field > 0 }`))).toThrow(
      /ghatana vrtti.*is not an aagama field/,
    )
  })

  it('accepts karta as participant name (no aagama constraint)', () => {
    expect(() => check(smrWithGhatana(`ghatana { karta: applicant }`))).not.toThrow()
  })

  it('accepts karta as string literal', () => {
    expect(() => check(smrWithGhatana(`ghatana { karta: "external system" }`))).not.toThrow()
  })

  it('accepts sthala and kaarya as string literals', () => {
    expect(() => check(smrWithGhatana(`ghatana { sthala: "portal" kaarya: "submit form" }`))).not.toThrow()
  })

  it('accepts hetu-only ghatana', () => {
    expect(() => check(smrWithGhatana(`ghatana { hetu: prati 5 antara }`))).not.toThrow()
  })
})

// ─── Evaluator ───────────────────────────────────────────────────────────────

describe('evaluate()', () => {
  it('evaluates number literal', () => {
    const ast = parse('smriti t { adhipati: "T" aavartana: 1.0.0 stara: public aagama: x (sankhya) ghatana { vrtti: x > 0 } pravah { pada a { kaarya: "a" } svasti } }')
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.trigger?.vrtti) return
    expect(evaluate(smr.trigger.vrtti, { x: 5 })).toBe(true)
    expect(evaluate(smr.trigger.vrtti, { x: 0 })).toBe(false)
  })

  it('returns null for missing identifier', () => {
    const ast = parse('smriti t { adhipati: "T" aavartana: 1.0.0 stara: public aagama: x (sankhya) ghatana { vrtti: x > 0 } pravah { pada a { kaarya: "a" } svasti } }')
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.trigger?.vrtti) return
    expect(evaluate(smr.trigger.vrtti, {})).toBeNull()
  })

  it('short-circuits && when left is false', () => {
    const ast = parse('smriti t { adhipati: "T" aavartana: 1.0.0 stara: public aagama: x (sankhya) ghatana { vrtti: x > 10 && x < 5 } pravah { pada a { kaarya: "a" } svasti } }')
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.trigger?.vrtti) return
    // x=0: left (0>10=false) makes && false regardless of right
    expect(evaluate(smr.trigger.vrtti, { x: 0 })).toBe(false)
  })

  it('short-circuits || when left is true', () => {
    const ast = parse('smriti t { adhipati: "T" aavartana: 1.0.0 stara: public aagama: x (sankhya) ghatana { vrtti: x > 0 || x < 0 } pravah { pada a { kaarya: "a" } svasti } }')
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.trigger?.vrtti) return
    expect(evaluate(smr.trigger.vrtti, { x: 5 })).toBe(true)
  })
})

describe('toTarka()', () => {
  it('maps true → satya', ()   => expect(toTarka(true)).toBe('satya'))
  it('maps false → asatya', () => expect(toTarka(false)).toBe('asatya'))
  it('maps null → avyakta', () => expect(toTarka(null)).toBe('avyakta'))
  it('maps nonzero number → satya', () => expect(toTarka(42)).toBe('satya'))
  it('maps zero → asatya',          () => expect(toTarka(0)).toBe('asatya'))
  it('maps non-empty string → satya', () => expect(toTarka('hello')).toBe('satya'))
  it('maps empty string → asatya',    () => expect(toTarka('')).toBe('asatya'))
})

describe('evaluateGhatana()', () => {
  function makeGhatana(body: string): import('../src/ast.js').GhatanaDecl {
    const src = smrWithGhatana(body)
    const ast = parse(src)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti' || !smr.trigger) throw new Error('no ghatana')
    return smr.trigger
  }

  it('fires = true when vrtti is satya', () => {
    const g = makeGhatana(`ghatana { vrtti: amount > 0 }`)
    expect(evaluateGhatana(g, { amount: 50 }).fires).toBe(true)
  })

  it('fires = false when vrtti is asatya', () => {
    const g = makeGhatana(`ghatana { vrtti: amount > 100 }`)
    expect(evaluateGhatana(g, { amount: 10 }).fires).toBe(false)
  })

  it('fires = false when vrtti is avyakta (missing field)', () => {
    const g = makeGhatana(`ghatana { vrtti: amount > 0 }`)
    expect(evaluateGhatana(g, {}).fires).toBe(false)
  })

  it('fires = true when no vrtti declared', () => {
    const g = makeGhatana(`ghatana { hetu: prati 1 day }`)
    expect(evaluateGhatana(g, {}).fires).toBe(true)
  })

  it('evaluates karta as string literal', () => {
    const g = makeGhatana(`ghatana { karta: "system" }`)
    const r = evaluateGhatana(g, {} as Payload)
    expect(r.karta).toBe('system')
  })

  it('exposes vrtti as TarkaValue in result', () => {
    const g = makeGhatana(`ghatana { vrtti: amount > 0 }`)
    const r = evaluateGhatana(g, { amount: 5 })
    expect(r.vrtti).toBe('satya')
  })
})
