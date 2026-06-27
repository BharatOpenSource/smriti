import { describe, it, expect } from 'vitest'
import { lex, TokenKind } from '../src/lexer.js'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { exprStr } from '../src/ast.js'
import type { SmritiDecl, VibhagaDecl, PadaDecl } from '../src/ast.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDecl(src: string): SmritiDecl {
  const file = parse(src)
  return file.decls[0] as SmritiDecl
}

function flowItems(src: string) {
  return (getDecl(src).flow?.items ?? [])
}

function firstNiyama(src: string) {
  const vib = flowItems(src).find(i => i.kind === 'vibhaga') as VibhagaDecl
  return vib?.clauses[0]?.condition
}

// ─── Lexer: new operator tokens ───────────────────────────────────────────────

describe('lexer — expression operators', () => {
  it('tokenises == as EQEQ', () => {
    const toks = lex('a == b').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.EQEQ)
    expect(toks[1].value).toBe('==')
  })

  it('tokenises != as NEQ', () => {
    const toks = lex('a != b').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.NEQ)
  })

  it('tokenises < and > correctly (not confused with <=/>= )', () => {
    const toks = lex('a < b > c').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.LT)
    expect(toks[3].kind).toBe(TokenKind.GT)
  })

  it('tokenises <= and >= as compound tokens', () => {
    const toks = lex('a <= b >= c').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.LTE)
    expect(toks[1].value).toBe('<=')
    expect(toks[3].kind).toBe(TokenKind.GTE)
    expect(toks[3].value).toBe('>=')
  })

  it('tokenises && and || as compound tokens', () => {
    const toks = lex('a && b || c').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.AND)
    expect(toks[3].kind).toBe(TokenKind.OR)
  })

  it('tokenises ! (BANG) and distinguishes it from !=', () => {
    const toks = lex('! a != b').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[0].kind).toBe(TokenKind.BANG)
    expect(toks[2].kind).toBe(TokenKind.NEQ)
  })
})

// ─── Parser: expression grammar ───────────────────────────────────────────────

describe('parser — expression grammar', () => {
  const mkVib = (cond: string, target = 'svasti') => `
smriti test {
  pravah {
    vibhaga result {
      niyama ${cond} → ${target}
    }
    svasti
    anaapta
  }
}
`
  it('parses tarka literal (existing)', () => {
    const expr = firstNiyama(mkVib('satya'))
    expect(expr?.kind).toBe('tarka-literal')
  })

  it('parses comparison: score >= 85', () => {
    const expr = firstNiyama(mkVib('score >= 85'))
    expect(expr?.kind).toBe('compare')
    if (expr?.kind !== 'compare') return
    expect(expr.op).toBe('>=')
    expect(expr.left.kind).toBe('identifier')
    expect(expr.right.kind).toBe('number-literal')
  })

  it('parses equality with string: status == "approved"', () => {
    const expr = firstNiyama(mkVib('status == "approved"'))
    expect(expr?.kind).toBe('compare')
    if (expr?.kind !== 'compare') return
    expect(expr.op).toBe('==')
    expect(expr.right.kind).toBe('string-literal')
    if (expr.right.kind === 'string-literal') expect(expr.right.value).toBe('approved')
  })

  it('parses logical and: a >= 18 && b == satya', () => {
    const expr = firstNiyama(mkVib('a >= 18 && b == satya'))
    expect(expr?.kind).toBe('logical')
    if (expr?.kind !== 'logical') return
    expect(expr.op).toBe('&&')
    expect(expr.left.kind).toBe('compare')
    expect(expr.right.kind).toBe('compare')
  })

  it('parses logical or', () => {
    const expr = firstNiyama(mkVib('a < 0 || b > 100'))
    expect(expr?.kind).toBe('logical')
    if (expr?.kind !== 'logical') return
    expect(expr.op).toBe('||')
  })

  it('parses not expression: !verified', () => {
    const expr = firstNiyama(mkVib('!verified'))
    expect(expr?.kind).toBe('not')
    if (expr?.kind !== 'not') return
    expect(expr.operand.kind).toBe('identifier')
  })

  it('parses parenthesised expression', () => {
    const expr = firstNiyama(mkVib('(a > 0)'))
    expect(expr?.kind).toBe('compare')
  })

  it('parses complex: (age >= 18 && status == "active") || override', () => {
    const expr = firstNiyama(mkVib('(age >= 18 && status == "active") || override'))
    expect(expr?.kind).toBe('logical')
    if (expr?.kind !== 'logical') return
    expect(expr.op).toBe('||')
    expect(expr.left.kind).toBe('logical')   // (age >= 18 && status == "active")
    expect(expr.right.kind).toBe('identifier')
  })

  it('parses khanda (guard clause) with expression', () => {
    const src = `
smriti test {
  pravah {
    pada step {
      khanda: age >= 18 && citizen == satya
      kaarya: "Do something"
    }
    svasti
  }
}
`
    const pada = flowItems(src).find(i => i.kind === 'pada') as PadaDecl
    expect(pada.khanda?.kind).toBe('logical')
  })
})

// ─── exprStr: rendering ───────────────────────────────────────────────────────

describe('exprStr — expression rendering', () => {
  it('renders tarka literal', () => {
    expect(exprStr({ kind: 'tarka-literal', value: 'satya', pos: { line: 1, col: 1 } })).toBe('satya')
  })

  it('renders comparison', () => {
    const e = firstNiyama(`
smriti t { pravah { vibhaga r { niyama score >= 85 → svasti } svasti anaapta } }
`)
    expect(exprStr(e!)).toBe('score >= 85')
  })

  it('renders logical with parens', () => {
    const e = firstNiyama(`
smriti t { pravah { vibhaga r { niyama a > 0 && b < 10 → svasti } svasti anaapta } }
`)
    expect(exprStr(e!)).toBe('(a > 0 && b < 10)')
  })

  it('renders not expression', () => {
    expect(exprStr({
      kind: 'not',
      operand: { kind: 'identifier', name: 'expired', pos: { line: 1, col: 1 } },
      pos: { line: 1, col: 1 },
    })).toBe('!expired')
  })

  it('renders string literal with quotes', () => {
    expect(exprStr({ kind: 'string-literal', value: 'pending', pos: { line: 1, col: 1 } })).toBe('"pending"')
  })
})

// ─── Typechecker: expression validation ──────────────────────────────────────

describe('typechecker — expressions', () => {
  it('accepts valid comparison: number vs number', () => {
    const src = `
smriti t { pravah { vibhaga r { niyama 42 > 0 → svasti  niyama 42 <= 0 → anaapta } svasti anaapta } }
`
    expect(() => typecheck(parse(src))).not.toThrow()
  })

  it('accepts comparison with identifier (unknown type, passes)', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama score >= 85 → svasti
  niyama score < 85  → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).not.toThrow()
  })

  it('rejects ordering comparison with string literal', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama "hello" > "world" → svasti
  niyama avyakta → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).toThrow(/requires numeric operands/)
  })

  it('rejects logical with number operand', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama 42 && satya → svasti
  niyama avyakta → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).toThrow(/expected tarka/)
  })

  it('rejects ! applied to number literal', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama !42 → svasti
  niyama avyakta → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).toThrow(/'!' applied to number/)
  })

  it('rejects type mismatch in ==: number vs string', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama 42 == "hello" → svasti
  niyama avyakta → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).toThrow(/type mismatch/)
  })

  it('accepts mixed vibhaga (non-tarka conditions) without exhaustiveness error', () => {
    const src = `
smriti t { pravah { vibhaga r {
  niyama score >= 85 → svasti
  niyama score < 85  → anaapta
} svasti anaapta } }
`
    expect(() => typecheck(parse(src))).not.toThrow()
  })
})
