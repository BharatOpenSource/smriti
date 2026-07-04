import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { evaluateKriya } from '../src/evaluator.js'
import type { KriyaDecl, TernaryExpr } from '../src/ast.js'

// ─── Ternary conditional + string concatenation fix + budgeted recursion ──────

function tc(src: string) { return typecheck(parse(src)) }
function tcFail(src: string) { expect(() => tc(src)).toThrow() }
function tcPass(src: string) { expect(() => tc(src)).not.toThrow() }

function getKriya(src: string, name: string): KriyaDecl {
  const file = parse(src)
  const k = file.decls.find(d => d.kind === 'kriya' && d.name === name) as KriyaDecl | undefined
  if (!k) throw new Error(`kriya '${name}' not found`)
  return k
}

// ─── Parser — ternary ──────────────────────────────────────────────────────────

describe('ternary — parser', () => {
  it('parses a basic ternary', () => {
    const k = getKriya(`
      kriya f {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n > 0 ? n : 0
      }
    `, 'f')
    const expr = k.body[0].kind === 'assign' ? k.body[0].expr : undefined
    expect(expr?.kind).toBe('ternary')
    const t = expr as TernaryExpr
    expect(t.condition.kind).toBe('compare')
  })

  it('right-associates chained ternaries', () => {
    const k = getKriya(`
      kriya f {
        aagama: n (sankhya)
        nirgama: label (vakya)
        label = n > 10 ? "big" : n > 0 ? "small" : "zero-or-negative"
      }
    `, 'f')
    const expr = k.body[0].kind === 'assign' ? k.body[0].expr : undefined
    const outer = expr as TernaryExpr
    expect(outer.then).toMatchObject({ kind: 'string-literal', value: 'big' })
    expect(outer.else.kind).toBe('ternary')
  })
})

// ─── Typechecker — ternary ─────────────────────────────────────────────────────

describe('ternary — typechecker', () => {
  it('accepts a tarka-valued condition', () => {
    tcPass(`
      kriya f {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n > 0 ? n : 0
      }
    `)
  })

  it('rejects a numeric condition', () => {
    // Identifiers are type-'unknown' at this shallow checking pass (declared field types
    // aren't tracked here — same as compare/logical elsewhere), so this needs a concrete
    // numeric literal to trigger the check, not an identifier.
    tcFail(`
      kriya f {
        nirgama: result (sankhya)
        result = 5 ? 1 : 0
      }
    `)
  })
})

// ─── Typechecker — string concatenation fix ───────────────────────────────────

describe("'+' string concatenation — typechecker", () => {
  it('accepts a string literal concatenated with a vakya identifier', () => {
    tcPass(`
      kriya greet {
        aagama: first (vakya)
        nirgama: full (vakya)
        full = first + " World"
      }
    `)
  })

  it('accepts two string literals', () => {
    tcPass(`
      kriya f {
        nirgama: s (vakya)
        s = "a" + "b"
      }
    `)
  })

  it('still rejects a numeric literal concatenated with a string literal', () => {
    tcFail(`
      kriya f {
        nirgama: s (vakya)
        s = 1 + "b"
      }
    `)
  })

  it('still rejects subtraction between strings (only + means concatenation)', () => {
    // Same shallow-checking note as above — identifiers are 'unknown', so this needs
    // concrete string literals to trigger the check.
    tcFail(`
      kriya f {
        nirgama: s (vakya)
        s = "a" - "b"
      }
    `)
  })
})

// ─── Evaluator — ternary ───────────────────────────────────────────────────────

describe('ternary — evaluator', () => {
  it('evaluates the then-branch when condition is true', () => {
    const k = getKriya(`
      kriya f {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n > 0 ? n : 0
      }
    `, 'f')
    const env = new Map([['f', k]])
    expect(evaluateKriya(k, [5], env).result).toBe(5)
  })

  it('evaluates the else-branch when condition is false', () => {
    const k = getKriya(`
      kriya f {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n > 0 ? n : 0
      }
    `, 'f')
    const env = new Map([['f', k]])
    expect(evaluateKriya(k, [-5], env).result).toBe(0)
  })
})

// ─── Evaluator — budgeted recursion ────────────────────────────────────────────

describe('recursion — evaluator', () => {
  it('computes factorial via a self-recursive call bounded by a ternary base case', () => {
    const k = getKriya(`
      kriya factorial {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n <= 1 ? 1 : n * factorial(n - 1)
      }
    `, 'factorial')
    const env = new Map([['factorial', k]])
    expect(evaluateKriya(k, [5], env).result).toBe(120)
    expect(evaluateKriya(k, [0], env).result).toBe(1)
  })

  it('throws when a recursive call has no terminating base case (budget exceeded)', () => {
    const k = getKriya(`
      kriya loopy {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = loopy(n)
      }
    `, 'loopy')
    const env = new Map([['loopy', k]])
    expect(() => evaluateKriya(k, [1], env)).toThrow(/call budget exceeded/)
  })

  it('a small explicit budget is exhausted quickly instead of overflowing the stack', () => {
    const k = getKriya(`
      kriya factorial {
        aagama: n (sankhya)
        nirgama: result (sankhya)
        result = n <= 1 ? 1 : n * factorial(n - 1)
      }
    `, 'factorial')
    const env = new Map([['factorial', k]])
    expect(() => evaluateKriya(k, [1000], env, [10])).toThrow(/call budget exceeded/)
  })
})
