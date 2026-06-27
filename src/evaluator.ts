import type { Expression } from './ast.js'

// ─── Value types ──────────────────────────────────────────────────────────────

export type EvalValue = number | string | boolean | null

// null → avyakta (indeterminate — unresolved or error)
export type TarkaValue = 'satya' | 'asatya' | 'avyakta'

export type Payload = Record<string, EvalValue>

// ─── Evaluator ───────────────────────────────────────────────────────────────

export function evaluate(expr: Expression, payload: Payload): EvalValue {
  switch (expr.kind) {
    case 'number-literal': return expr.value
    case 'string-literal': return expr.value
    case 'tarka-literal':
      return expr.value === 'satya' ? true : expr.value === 'asatya' ? false : null

    case 'identifier': {
      const v = payload[expr.name]
      return v !== undefined ? v : null
    }

    case 'compare': {
      const l = evaluate(expr.left, payload)
      const r = evaluate(expr.right, payload)
      if (l === null || r === null) return null
      switch (expr.op) {
        case '==': return l === r
        case '!=': return l !== r
        case '<':  return (l as number) < (r as number)
        case '>':  return (l as number) > (r as number)
        case '<=': return (l as number) <= (r as number)
        case '>=': return (l as number) >= (r as number)
      }
    }

    case 'logical': {
      const l = evaluate(expr.left, payload)
      const r = evaluate(expr.right, payload)
      if (expr.op === '&&') {
        if (l === false || r === false) return false
        if (l === null || r === null) return null
        return true
      } else {
        if (l === true || r === true) return true
        if (l === null || r === null) return null
        return false
      }
    }

    case 'not': {
      const v = evaluate(expr.operand, payload)
      if (v === null) return null
      return !v
    }
  }
}

export function toTarka(value: EvalValue): TarkaValue {
  if (value === null)              return 'avyakta'
  if (value === true)              return 'satya'
  if (value === false)             return 'asatya'
  if (typeof value === 'number')   return value !== 0 ? 'satya' : 'asatya'
  if (typeof value === 'string')   return value.length > 0 ? 'satya' : 'asatya'
  return 'avyakta'
}

// ─── Ghatana evaluation ──────────────────────────────────────────────────────

export interface GhatanaResult {
  vrtti?:  TarkaValue
  karta?:  EvalValue
  sthala?: EvalValue
  kaarya?: EvalValue
  fires:   boolean    // true when vrtti is satya (or absent)
}

import type { GhatanaDecl } from './ast.js'

export function evaluateGhatana(ghatana: GhatanaDecl, payload: Payload): GhatanaResult {
  const vrtti  = ghatana.vrtti  ? toTarka(evaluate(ghatana.vrtti,  payload)) : undefined
  const karta  = ghatana.karta  ? evaluate(ghatana.karta,  payload) : undefined
  const sthala = ghatana.sthala ? evaluate(ghatana.sthala, payload) : undefined
  const kaarya = ghatana.kaarya ? evaluate(ghatana.kaarya, payload) : undefined

  // fires when vrtti is satya, or when no vrtti is declared (unconditional)
  const fires = vrtti === undefined || vrtti === 'satya'

  return { vrtti, karta, sthala, kaarya, fires }
}
