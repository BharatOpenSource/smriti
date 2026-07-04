import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { evaluateKriya } from '../src/evaluator.js'
import type { KriyaDecl, IterateStmt, MemberExpr } from '../src/ast.js'

// ─── Layer: kramana (iteration) + rachana (record type) ───────────────────────

function tc(src: string) { return typecheck(parse(src)) }
function tcFail(src: string) { expect(() => tc(src)).toThrow() }
function tcPass(src: string) { expect(() => tc(src)).not.toThrow() }

function getKriya(src: string, name: string): KriyaDecl {
  const file = parse(src)
  const k = file.decls.find(d => d.kind === 'kriya' && d.name === name) as KriyaDecl | undefined
  if (!k) throw new Error(`kriya '${name}' not found`)
  return k
}

// ─── Parser — rachana type ────────────────────────────────────────────────────

describe('rachana — parser', () => {
  it('parses a rachana type with named fields', () => {
    const k = getKriya(`
      kriya f {
        aagama: person (rachana[name (vakya), age (sankhya)])
        nirgama: ok (tarka)
        ok = satya
      }
    `, 'f')
    const t = k.aagama[0].type
    expect(t.kind).toBe('rachana')
    if (t.kind !== 'rachana') return
    expect(t.fields.map(f => f.name)).toEqual(['name', 'age'])
    expect(t.fields[1].type.kind).toBe('sankhya')
  })

  it('parses rachana nested inside krama', () => {
    const k = getKriya(`
      kriya f {
        aagama: people (krama[rachana[name (vakya), age (sankhya)]])
        nirgama: ok (tarka)
        ok = satya
      }
    `, 'f')
    const t = k.aagama[0].type
    expect(t.kind).toBe('krama')
    if (t.kind !== 'krama') return
    expect(t.of.kind).toBe('rachana')
  })
})

// ─── Parser — kramana (iteration) ─────────────────────────────────────────────

describe('kramana — parser', () => {
  it('parses single-binding iteration over a krama', () => {
    const k = getKriya(`
      kriya sum-list {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana item : numbers {
          total = total + item
        }
      }
    `, 'sum-list')
    const stmt = k.body[1] as IterateStmt
    expect(stmt.kind).toBe('iterate')
    expect(stmt.bindings).toEqual(['item'])
    expect(stmt.collection).toBe('numbers')
    expect(stmt.body).toHaveLength(1)
  })

  it('parses two-binding iteration over a kosa', () => {
    const k = getKriya(`
      kriya sum-values {
        aagama: scores (kosa[vakya, sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana key, value : scores {
          total = total + value
        }
      }
    `, 'sum-values')
    const stmt = k.body[1] as IterateStmt
    expect(stmt.bindings).toEqual(['key', 'value'])
    expect(stmt.collection).toBe('scores')
  })
})

// ─── Parser — member access ────────────────────────────────────────────────────

describe('member access — parser', () => {
  it('parses a single-level member access', () => {
    const k = getKriya(`
      kriya f {
        aagama: person (rachana[name (vakya)])
        nirgama: label (vakya)
        label = person.name
      }
    `, 'f')
    const expr = k.body[0].kind === 'assign' ? k.body[0].expr : undefined
    expect(expr?.kind).toBe('member')
    const m = expr as MemberExpr
    expect(m.field).toBe('name')
    expect(m.object.kind).toBe('identifier')
  })

  it('parses chained member access', () => {
    const k = getKriya(`
      kriya f {
        aagama: person (rachana[addr (rachana[city (vakya)])])
        nirgama: label (vakya)
        label = person.addr.city
      }
    `, 'f')
    const expr = k.body[0].kind === 'assign' ? k.body[0].expr : undefined
    const m = expr as MemberExpr
    expect(m.field).toBe('city')
    expect(m.object.kind).toBe('member')
  })
})

// ─── Typechecker — kramana ─────────────────────────────────────────────────────

describe('kramana — typechecker', () => {
  it('accepts single binding over a krama field', () => {
    tcPass(`
      kriya f {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana item : numbers { total = total + item }
      }
    `)
  })

  it('accepts two bindings over a kosa field', () => {
    tcPass(`
      kriya f {
        aagama: scores (kosa[vakya, sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana key, value : scores { total = total + value }
      }
    `)
  })

  it('rejects wrong binding count over a krama (expects one, got two)', () => {
    tcFail(`
      kriya f {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana a, b : numbers { total = total + a }
      }
    `)
  })

  it('rejects wrong binding count over a kosa (expects two, got one)', () => {
    tcFail(`
      kriya f {
        aagama: scores (kosa[vakya, sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana item : scores { total = total + item }
      }
    `)
  })

  it('rejects iterating over a non-collection field', () => {
    tcFail(`
      kriya f {
        aagama: name (vakya)
        nirgama: total (sankhya)
        total = 0
        kramana item : name { total = total + item }
      }
    `)
  })

  it('rejects iterating over an undeclared identifier', () => {
    tcFail(`
      kriya f {
        nirgama: total (sankhya)
        total = 0
        kramana item : ghost { total = total + item }
      }
    `)
  })

  it('an accumulator assigned only inside the loop satisfies nirgama coverage', () => {
    tcPass(`
      kriya f {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        kramana item : numbers { total = item }
      }
    `)
  })

  it('rejects a duplicate field name inside a rachana type', () => {
    tcFail(`
      kriya f {
        aagama: person (rachana[name (vakya), name (sankhya)])
        nirgama: ok (tarka)
        ok = satya
      }
    `)
  })
})

// ─── Evaluator — kramana execution ────────────────────────────────────────────

describe('kramana — evaluator', () => {
  it('sums a krama of numbers via an accumulator', () => {
    const k = getKriya(`
      kriya sum-list {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana item : numbers { total = total + item }
      }
    `, 'sum-list')
    const env = new Map([['sum-list', k]])
    const result = evaluateKriya(k, [[1, 2, 3, 4]], env)
    expect(result.total).toBe(10)
  })

  it('sums the values of a kosa via key/value bindings', () => {
    const k = getKriya(`
      kriya sum-values {
        aagama: scores (kosa[vakya, sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana key, value : scores { total = total + value }
      }
    `, 'sum-values')
    const env = new Map([['sum-values', k]])
    const result = evaluateKriya(k, [{ a: 1, b: 2, c: 3 }], env)
    expect(result.total).toBe(6)
  })

  it('performs zero iterations over a null (avyakta) collection', () => {
    const k = getKriya(`
      kriya sum-list {
        aagama: numbers (krama[sankhya])
        nirgama: total (sankhya)
        total = 0
        kramana item : numbers { total = total + item }
      }
    `, 'sum-list')
    const env = new Map([['sum-list', k]])
    const result = evaluateKriya(k, [null], env)
    expect(result.total).toBe(0)
  })

  it('sums a field from a krama of rachana records via member access', () => {
    const k = getKriya(`
      kriya sum-ages {
        aagama: people (krama[rachana[name (vakya), age (sankhya)]])
        nirgama: total (sankhya)
        total = 0
        kramana person : people { total = total + person.age }
      }
    `, 'sum-ages')
    const env = new Map([['sum-ages', k]])
    const result = evaluateKriya(k, [[{ name: 'a', age: 10 }, { name: 'b', age: 20 }]], env)
    expect(result.total).toBe(30)
  })

  it('loop bindings do not leak outside the loop body', () => {
    const k = getKriya(`
      kriya f {
        aagama: numbers (krama[sankhya])
        nirgama: last (sankhya)
        kramana item : numbers { last = item }
      }
    `, 'f')
    const env = new Map([['f', k]])
    const result = evaluateKriya(k, [[7, 8, 9]], env)
    expect(result.item).toBeUndefined()
    expect(result.last).toBe(9)
  })
})
