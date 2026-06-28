import { describe, it, expect } from 'vitest'
import { lex, TokenKind } from '../src/lexer.js'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { evaluate, evaluateKriya, buildKriyaEnv } from '../src/evaluator.js'
import { exprStr } from '../src/ast.js'
import type { KriyaDecl, SmritiDecl, SutraDecl, PadaDecl, VarnaDecl, CallExpr } from '../src/ast.js'

function tc(src: string) { return typecheck(parse(src)) }
function tcFail(src: string) { expect(() => tc(src)).toThrow() }
function tcPass(src: string) { expect(() => tc(src)).not.toThrow() }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseKriya(src: string): KriyaDecl {
  const file = parse(src)
  return file.decls[0] as KriyaDecl
}

function smriti(src: string): SmritiDecl {
  return parse(src).decls[0] as SmritiDecl
}

// ─── Lexer ────────────────────────────────────────────────────────────────────

describe('lexer — kriya and sparsha keywords', () => {
  it('tokenises kriya as KRIYA', () => {
    const toks = lex('kriya').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[0].kind).toBe(TokenKind.KRIYA)
  })

  it('tokenises sparsha as SPARSHA', () => {
    const toks = lex('sparsha').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[0].kind).toBe(TokenKind.SPARSHA)
  })
})

describe('lexer — arithmetic operators', () => {
  it('tokenises + * / %', () => {
    const toks = lex('a + b * c / d % e').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.PLUS)
    expect(toks[3].kind).toBe(TokenKind.STAR)
    expect(toks[5].kind).toBe(TokenKind.SLASH)
    expect(toks[7].kind).toBe(TokenKind.PERCENT)
  })

  it('tokenises - as MINUS (not ARROW)', () => {
    const toks = lex('a - b').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.MINUS)
    expect(toks[1].value).toBe('-')
  })

  it('still tokenises -> as ARROW (MINUS check comes after)', () => {
    const toks = lex('a -> b').filter(t => t.kind !== TokenKind.EOF)
    expect(toks[1].kind).toBe(TokenKind.ARROW)
  })

  it('tokenises identifier with hyphen as single token (not split by MINUS)', () => {
    const toks = lex('validate-amount').filter(t => t.kind !== TokenKind.EOF)
    expect(toks.length).toBe(1)
    expect(toks[0].value).toBe('validate-amount')
  })
})

// ─── Parser: top-level kriya ──────────────────────────────────────────────────

describe('parser — top-level kriya declaration', () => {
  it('parses a minimal pure kriya (no inputs or outputs)', () => {
    const k = parseKriya(`
kriya no-op {
  satya
}
`)
    expect(k.kind).toBe('kriya')
    expect(k.name).toBe('no-op')
    expect(k.sparsha).toBeUndefined()
    expect(k.aagama).toHaveLength(0)
    expect(k.nirgama).toHaveLength(0)
    expect(k.body).toHaveLength(1)
  })

  it('parses kriya with aagama and nirgama', () => {
    const k = parseKriya(`
kriya validate-amount {
  aagama: amount (sankhya)
  nirgama: result (tarka)
  result = amount > 0
}
`)
    expect(k.aagama).toHaveLength(1)
    expect(k.aagama[0].name).toBe('amount')
    expect(k.aagama[0].type.kind).toBe('sankhya')
    expect(k.nirgama).toHaveLength(1)
    expect(k.nirgama[0].name).toBe('result')
    expect(k.nirgama[0].type.kind).toBe('tarka')
  })

  it('parses assign-stmt in kriya body', () => {
    const k = parseKriya(`
kriya validate-amount {
  aagama: amount (sankhya)
  nirgama: result (tarka)
  result = amount > 0
}
`)
    const stmt = k.body[0]
    expect(stmt.kind).toBe('assign')
    if (stmt.kind !== 'assign') return
    expect(stmt.name).toBe('result')
    expect(stmt.expr.kind).toBe('compare')
  })

  it('parses expr-stmt (side-effect call) in kriya body', () => {
    const k = parseKriya(`
kriya side-effect {
  log("done")
}
`)
    const stmt = k.body[0]
    expect(stmt.kind).toBe('expr-stmt')
    if (stmt.kind !== 'expr-stmt') return
    expect(stmt.expr.kind).toBe('call')
  })

  it('parses multiple statements in kriya body', () => {
    const k = parseKriya(`
kriya compute {
  aagama: a (sankhya), b (sankhya)
  nirgama: sum (sankhya), product (sankhya)
  sum = a + b
  product = a * b
}
`)
    expect(k.body).toHaveLength(2)
    expect(k.body[0].kind).toBe('assign')
    expect(k.body[1].kind).toBe('assign')
  })

  it('parses optional iti close marker', () => {
    const k = parseKriya(`
kriya check {
  satya
} iti check
`)
    expect(k.itiName).toBe('check')
  })
})

// ─── Parser: sparsha (effect declaration) ─────────────────────────────────────

describe('parser — sparsha block', () => {
  it('parses impure kriya with sparsha http:read', () => {
    const k = parseKriya(`
kriya fetch-gstin {
  sparsha {
    http: read
  }
  aagama: gstin (vakya)
  nirgama: status (vakya)
  status = "ok"
}
`)
    expect(k.sparsha).toBeDefined()
    expect(k.sparsha!.fields).toHaveLength(1)
    expect(k.sparsha!.fields[0].channel).toBe('http')
    expect(k.sparsha!.fields[0].mode).toBe('read')
  })

  it('parses multiple sparsha fields', () => {
    const k = parseKriya(`
kriya sync {
  sparsha {
    http: read
    file: write
    event: emit
  }
  satya
}
`)
    expect(k.sparsha!.fields).toHaveLength(3)
    expect(k.sparsha!.fields[1].channel).toBe('file')
    expect(k.sparsha!.fields[1].mode).toBe('write')
  })

  it('pure kriya has no sparsha', () => {
    const k = parseKriya(`kriya pure { satya }`)
    expect(k.sparsha).toBeUndefined()
  })
})

// ─── Parser: scoped kriya inside smriti ──────────────────────────────────────

describe('parser — scoped kriya inside smriti', () => {
  it('parses kriya block inside smriti body', () => {
    const d = smriti(`
smriti invoice-process {
  kriya validate-amount {
    aagama: amount (sankhya)
    nirgama: ok (tarka)
    ok = amount > 0
  }
  pravah {
    svasti
  }
}
`)
    expect(d.kriya).toHaveLength(1)
    expect(d.kriya[0].name).toBe('validate-amount')
  })

  it('parses multiple scoped kriya', () => {
    const d = smriti(`
smriti test {
  kriya fn-a { satya }
  kriya fn-b { asatya }
  pravah { svasti }
}
`)
    expect(d.kriya).toHaveLength(2)
    expect(d.kriya[0].name).toBe('fn-a')
    expect(d.kriya[1].name).toBe('fn-b')
  })

  it('smriti with no kriya has empty kriya array', () => {
    const d = smriti(`smriti test { pravah { svasti } }`)
    expect(d.kriya).toHaveLength(0)
  })

  it('parses scoped kriya inside sutra', () => {
    const src = `
sutra verify-pan {
  kriya helper {
    aagama: x (vakya)
    nirgama: y (tarka)
    y = satya
  }
  pravah { svasti }
}
`
    const sut = parse(src).decls[0] as SutraDecl
    expect(sut.kriya).toHaveLength(1)
    expect(sut.kriya[0].name).toBe('helper')
  })
})

// ─── Parser: kriya call expressions ──────────────────────────────────────────

describe('parser — kriya call expressions', () => {
  it('parses local call in varna expression', () => {
    const d = smriti(`
smriti test {
  pravah {
    varna is-valid : tarka = validate-amount(100)
    svasti
  }
}
`)
    const varna = d.flow!.items[0] as VarnaDecl
    expect(varna.expr?.kind).toBe('call')
    const call = varna.expr as CallExpr
    expect(call.callee).toBe('validate-amount')
    expect(call.args).toHaveLength(1)
    expect(call.args[0].kind).toBe('number-literal')
  })

  it('parses call with multiple args', () => {
    const d = smriti(`
smriti test {
  pravah {
    varna result : tarka = check(a, b, 42)
    svasti
  }
}
`)
    const varna = d.flow!.items[0] as VarnaDecl
    const call = varna.expr as CallExpr
    expect(call.args).toHaveLength(3)
  })

  it('parses zero-arg call', () => {
    const d = smriti(`
smriti test {
  pravah {
    varna t : tarka = now()
    svasti
  }
}
`)
    const varna = d.flow!.items[0] as VarnaDecl
    const call = varna.expr as CallExpr
    expect(call.args).toHaveLength(0)
  })

  it('parses qualified call (namespace.fn)', () => {
    const d = smriti(`
smriti test {
  pravah {
    varna ok : tarka = gov.verify(pan)
    svasti
  }
}
`)
    const varna = d.flow!.items[0] as VarnaDecl
    const call = varna.expr as CallExpr
    expect(typeof call.callee).toBe('object')
    if (typeof call.callee === 'object') {
      expect(call.callee.namespace).toBe('gov')
      expect(call.callee.name).toBe('verify')
    }
  })

  it('parses kriya invocation in pada kaarya field', () => {
    const d = smriti(`
smriti test {
  pravah {
    pada compute {
      kaarya: kriya validate-amount(invoice-amount)
      nirgama: result (tarka)
    }
    svasti
  }
}
`)
    const pada = d.flow!.items[0] as PadaDecl
    expect(typeof pada.kaarya).toBe('object')
    const call = pada.kaarya as CallExpr
    expect(call.kind).toBe('call')
    expect(call.callee).toBe('validate-amount')
    expect(call.args).toHaveLength(1)
  })

  it('string kaarya still works unchanged', () => {
    const d = smriti(`
smriti test {
  pravah {
    pada step { kaarya: "vendor submits invoice" }
    svasti
  }
}
`)
    const pada = d.flow!.items[0] as PadaDecl
    expect(typeof pada.kaarya).toBe('string')
    expect(pada.kaarya).toBe('vendor submits invoice')
  })
})

// ─── Parser: arithmetic expressions ──────────────────────────────────────────

describe('parser — arithmetic expressions', () => {
  const mkVarna = (expr: string) => `
smriti test {
  pravah {
    varna x : sankhya = ${expr}
    svasti
  }
}
`
  function getVarnaExpr(src: string) {
    return (smriti(src).flow!.items[0] as VarnaDecl).expr!
  }

  it('parses addition: a + b', () => {
    const e = getVarnaExpr(mkVarna('a + b'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('+')
  })

  it('parses subtraction: price - discount', () => {
    const e = getVarnaExpr(mkVarna('price - discount'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('-')
  })

  it('parses multiplication: rate * units', () => {
    const e = getVarnaExpr(mkVarna('rate * units'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('*')
  })

  it('parses division: total / count', () => {
    const e = getVarnaExpr(mkVarna('total / count'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('/')
  })

  it('parses modulo: index % size', () => {
    const e = getVarnaExpr(mkVarna('index % size'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('%')
  })

  it('* binds tighter than + (left operand of + is a multiply)', () => {
    const e = getVarnaExpr(mkVarna('a + b * c'))
    expect(e.kind).toBe('arith')
    if (e.kind !== 'arith') return
    expect(e.op).toBe('+')
    expect(e.right.kind).toBe('arith')
    if (e.right.kind === 'arith') expect(e.right.op).toBe('*')
  })

  it('parses unary minus: -x', () => {
    const e = getVarnaExpr(mkVarna('-x'))
    expect(e.kind).toBe('negate')
    if (e.kind !== 'negate') return
    expect(e.operand.kind).toBe('identifier')
  })

  it('parses arithmetic inside comparison: total + tax > 1000', () => {
    const src = `
smriti test {
  pravah {
    vibhaga check {
      niyama total + tax > 1000 → svasti
      niyama avyakta → anaapta
    }
    svasti
    anaapta
  }
}
`
    const vib = smriti(src).flow!.items[0]
    if (vib.kind !== 'vibhaga') return
    const cond = vib.clauses[0].condition
    expect(cond.kind).toBe('compare')
    if (cond.kind !== 'compare') return
    expect(cond.left.kind).toBe('arith')   // total + tax
    expect(cond.right.kind).toBe('number-literal')  // 1000
  })
})

// ─── exprStr: new expression rendering ───────────────────────────────────────

describe('exprStr — arithmetic and call rendering', () => {
  const P = { line: 1, col: 1 }
  const id = (name: string) => ({ kind: 'identifier' as const, name, pos: P })
  const num = (value: number) => ({ kind: 'number-literal' as const, value, pos: P })

  it('renders arith: a + b', () => {
    expect(exprStr({ kind: 'arith', left: id('a'), op: '+', right: id('b'), pos: P })).toBe('(a + b)')
  })

  it('renders negate: -x', () => {
    expect(exprStr({ kind: 'negate', operand: id('x'), pos: P })).toBe('-x')
  })

  it('renders local call: validate(a, 42)', () => {
    expect(exprStr({ kind: 'call', callee: 'validate', args: [id('a'), num(42)], pos: P }))
      .toBe('validate(a, 42)')
  })

  it('renders qualified call: gov.verify(pan)', () => {
    expect(exprStr({
      kind: 'call',
      callee: { namespace: 'gov', name: 'verify' },
      args: [id('pan')],
      pos: P,
    })).toBe('gov.verify(pan)')
  })

  it('renders zero-arg call: now()', () => {
    expect(exprStr({ kind: 'call', callee: 'now', args: [], pos: P })).toBe('now()')
  })
})

// ─── Typechecker: kriya ───────────────────────────────────────────────────────

describe('typechecker — kriya valid cases', () => {
  it('accepts a minimal pure kriya', () => {
    tcPass(`kriya no-op { satya }`)
  })

  it('accepts kriya with aagama + nirgama + assignment', () => {
    tcPass(`
kriya validate-amount {
  aagama: amount (sankhya)
  nirgama: result (tarka)
  result = amount > 0
}
`)
  })

  it('accepts kriya with optional nirgama not assigned', () => {
    tcPass(`
kriya maybe-result {
  nirgama: vikalpa msg (vakya)
  satya
}
`)
  })

  it('accepts impure kriya with valid sparsha', () => {
    tcPass(`
kriya fetch-gstin {
  sparsha {
    http: read
  }
  aagama: gstin (vakya)
  nirgama: status (vakya)
  status = "ok"
}
`)
  })

  it('accepts multiple sparsha fields', () => {
    tcPass(`
kriya sync {
  sparsha {
    http: read
    file: write
  }
  nirgama: done (tarka)
  done = satya
}
`)
  })

  it('accepts scoped kriya inside smriti', () => {
    tcPass(`
smriti invoice-process {
  kriya validate-amount {
    aagama: amount (sankhya)
    nirgama: ok (tarka)
    ok = amount > 0
  }
  pravah { svasti }
}
`)
  })

  it('accepts arithmetic expressions in kriya body', () => {
    tcPass(`
kriya compute {
  aagama: price (sankhya), tax (sankhya)
  nirgama: total (sankhya)
  total = price + tax
}
`)
  })

  it('accepts intermediate local variable (not in nirgama) — locals allowed', () => {
    tcPass(`
kriya compute {
  aagama: a (sankhya)
  nirgama: result (sankhya)
  temp = a * 2
  result = temp
}
`)
  })

  it('accepts call expression in body (callee resolution deferred)', () => {
    tcPass(`
kriya wrapper {
  aagama: x (sankhya)
  nirgama: y (tarka)
  y = validate(x)
}
`)
  })
})

describe('typechecker — kriya error cases', () => {
  it('rejects kriya where required nirgama is never assigned', () => {
    expect(() => tc(`
kriya broken {
  nirgama: result (tarka)
  satya
}
`)).toThrow(/nirgama 'result'.*never assigned/)
  })

  it('rejects kriya with invalid sparsha channel', () => {
    expect(() => tc(`
kriya bad {
  sparsha { network: read }
  nirgama: done (tarka)
  done = satya
}
`)).toThrow(/unknown effect channel 'network'/)
  })

  it('rejects kriya with invalid sparsha mode', () => {
    expect(() => tc(`
kriya bad {
  sparsha { http: stream }
  nirgama: done (tarka)
  done = satya
}
`)).toThrow(/unknown effect mode 'stream'/)
  })

  it('rejects arithmetic on tarka in kriya body', () => {
    expect(() => tc(`
kriya bad {
  nirgama: result (sankhya)
  result = satya + 1
}
`)).toThrow(/left side of '\+' is tarka/)
  })

  it('rejects arithmetic on string in kriya body', () => {
    expect(() => tc(`
kriya bad {
  nirgama: result (sankhya)
  result = "hello" * 2
}
`)).toThrow(/left side of '\*' is string/)
  })

  it('rejects unary minus on tarka', () => {
    expect(() => tc(`
kriya bad {
  nirgama: result (sankhya)
  result = -satya
}
`)).toThrow(/unary '-' applied to tarka/)
  })

  it('rejects iti mismatch on kriya', () => {
    expect(() => tc(`
kriya validate {
  satya
} iti wrong-name
`)).toThrow(/iti name 'wrong-name' does not match block name 'validate'/)
  })

  it('rejects duplicate aagama field names', () => {
    expect(() => tc(`
kriya bad {
  aagama: amount (sankhya), amount (tarka)
  nirgama: ok (tarka)
  ok = satya
}
`)).toThrow(/Duplicate field name 'amount'/)
  })
})

describe('typechecker — arithmetic expression checks', () => {
  const mkVib = (cond: string) => `
smriti test {
  pravah {
    vibhaga r {
      niyama ${cond} → svasti
      niyama avyakta → anaapta
    }
    svasti
    anaapta
  }
}
`
  it('accepts numeric arithmetic in comparison', () => {
    tcPass(mkVib('a + b > 0'))
  })

  it('rejects tarka in arithmetic', () => {
    expect(() => tc(mkVib('satya + 1 > 0'))).toThrow(/left side of '\+' is tarka/)
  })

  it('rejects string in arithmetic', () => {
    expect(() => tc(mkVib('"hello" - 1 > 0'))).toThrow(/left side of '-' is string/)
  })

  it('rejects unary minus on string', () => {
    expect(() => tc(mkVib('-"hello" > 0'))).toThrow(/unary '-' applied to string/)
  })

  it('accepts unary minus on number', () => {
    tcPass(mkVib('-amount > 0'))
  })
})

// ─── Evaluator: kriya dispatch ────────────────────────────────────────────────

function compileAndEnv(src: string) {
  const file = parse(src)
  typecheck(file)
  return { file, env: buildKriyaEnv(file) }
}

function getKriya(src: string, name: string): KriyaDecl {
  const file = parse(src)
  const k = file.decls.find(d => d.kind === 'kriya' && d.name === name) as KriyaDecl | undefined
  if (!k) throw new Error(`kriya '${name}' not found`)
  return k
}

describe('buildKriyaEnv', () => {
  it('collects top-level kriya', () => {
    const { env } = compileAndEnv(`kriya no-op { satya }`)
    expect(env.has('no-op')).toBe(true)
  })

  it('collects scoped kriya from smriti', () => {
    const { env } = compileAndEnv(`
smriti test {
  kriya validate { nirgama: ok (tarka)  ok = satya }
  pravah { svasti }
}
`)
    expect(env.has('validate')).toBe(true)
  })

  it('collects multiple kriya', () => {
    const { env } = compileAndEnv(`
kriya a { satya }
kriya b { satya }
kriya c { satya }
`)
    expect(env.size).toBe(3)
  })
})

describe('evaluateKriya', () => {
  it('returns empty payload for no-op kriya', () => {
    const k = getKriya(`kriya no-op { satya }`, 'no-op')
    const env = new Map([['no-op', k]])
    const result = evaluateKriya(k, [], env)
    expect(result).toEqual({})
  })

  it('binds aagama args to locals', () => {
    const k = getKriya(`
kriya double {
  aagama: x (sankhya)
  nirgama: result (sankhya)
  result = x * 2
}
`, 'double')
    const env = new Map([['double', k]])
    const result = evaluateKriya(k, [5], env)
    expect(result['result']).toBe(10)
  })

  it('handles sequential assignment (locals build up)', () => {
    const k = getKriya(`
kriya compute {
  aagama: a (sankhya), b (sankhya)
  nirgama: total (sankhya)
  half = a / 2
  total = half + b
}
`, 'compute')
    const env = new Map([['compute', k]])
    const result = evaluateKriya(k, [10, 3], env)
    expect(result['total']).toBe(8)   // 10/2 + 3 = 8
  })

  it('returns null for div-by-zero (avyakta)', () => {
    const k = getKriya(`
kriya safe-div {
  aagama: a (sankhya), b (sankhya)
  nirgama: result (sankhya)
  result = a / b
}
`, 'safe-div')
    const env = new Map([['safe-div', k]])
    expect(evaluateKriya(k, [10, 0], env)['result']).toBeNull()
  })

  it('evaluates boolean nirgama', () => {
    const k = getKriya(`
kriya is-positive {
  aagama: x (sankhya)
  nirgama: ok (tarka)
  ok = x > 0
}
`, 'is-positive')
    const env = new Map([['is-positive', k]])
    expect(evaluateKriya(k, [5],  env)['ok']).toBe(true)
    expect(evaluateKriya(k, [-1], env)['ok']).toBe(false)
    expect(evaluateKriya(k, [0],  env)['ok']).toBe(false)
  })
})

describe('evaluate — call dispatch via env', () => {
  it('dispatches call to kriya and returns nirgama', () => {
    const src = `
kriya double {
  aagama: x (sankhya)
  nirgama: result (sankhya)
  result = x * 2
}
smriti test {
  pravah { svasti }
}
`
    const { file, env } = compileAndEnv(src)
    const k = file.decls.find(d => d.kind === 'kriya') as KriyaDecl
    // Build a call expression manually
    const callExpr: CallExpr = { kind: 'call', callee: 'double', args: [{ kind: 'number-literal', value: 7, pos: { line: 1, col: 1 } }], pos: { line: 1, col: 1 } }
    expect(evaluate(callExpr, {}, env)).toBe(14)
  })

  it('returns null for call to unknown kriya (no env)', () => {
    const callExpr: CallExpr = { kind: 'call', callee: 'missing', args: [], pos: { line: 1, col: 1 } }
    expect(evaluate(callExpr, {})).toBeNull()
  })

  it('returns null for unknown kriya name even with env', () => {
    const callExpr: CallExpr = { kind: 'call', callee: 'nope', args: [], pos: { line: 1, col: 1 } }
    expect(evaluate(callExpr, {}, new Map())).toBeNull()
  })

  it('chains kriya calls: one calls another via env', () => {
    const src = `
kriya double {
  aagama: x (sankhya)
  nirgama: result (sankhya)
  result = x * 2
}
kriya quadruple {
  aagama: x (sankhya)
  nirgama: result (sankhya)
  result = double(double(x))
}
`
    const { file, env } = compileAndEnv(src)
    const quad = file.decls.find(d => d.kind === 'kriya' && d.name === 'quadruple') as KriyaDecl
    const result = evaluateKriya(quad, [3], env)
    expect(result['result']).toBe(12)  // 3 * 2 * 2 = 12
  })
})
