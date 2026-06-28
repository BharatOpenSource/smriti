import type { Expression, KriyaDecl, SmritiFile, SthitiBlock } from './ast.js'
import { nameRefStr } from './ast.js'

// ─── Value types ──────────────────────────────────────────────────────────────

export type EvalValue = number | string | boolean | null

// null → avyakta (indeterminate — unresolved or error)
export type TarkaValue = 'satya' | 'asatya' | 'avyakta'

export type Payload = Record<string, EvalValue>

// ─── Kriya environment ────────────────────────────────────────────────────────

// Maps kriya name → declaration. Used by evaluate() to dispatch call expressions.
// Flat: top-level kriya and all scoped kriya from smriti/sutra share the same namespace
// for evaluation purposes (scoping enforced by the typechecker, not the evaluator).
export type KriyaEnv = Map<string, KriyaDecl>

export function buildKriyaEnv(file: SmritiFile): KriyaEnv {
  const env: KriyaEnv = new Map()
  for (const decl of file.decls) {
    if (decl.kind === 'kriya') {
      env.set(decl.name, decl)
    } else if (decl.kind === 'smriti' || decl.kind === 'sutra') {
      for (const k of decl.kriya) env.set(k.name, k)
    }
  }
  return env
}

// ─── Kriya execution ──────────────────────────────────────────────────────────

// Executes a kriya: binds args to aagama, runs body statements, returns locals.
// Caller extracts nirgama fields from the returned payload.
// Evaluates the initial values of a sthiti-block into a Payload.
// Called once per kriya invocation (kriya-local state) or once at process start (process-scoped).
export function buildInitialState(block: SthitiBlock, env: KriyaEnv): Payload {
  const state: Payload = {}
  for (const f of block.fields) {
    state[f.name] = f.init ? evaluate(f.init, state, env) : null
  }
  return state
}

export function evaluateKriya(decl: KriyaDecl, args: EvalValue[], env: KriyaEnv): Payload {
  const locals: Payload = {}

  // Seed sthiti initial state (kriya-local; re-initialised on each call)
  if (decl.sthitiBlock) {
    Object.assign(locals, buildInitialState(decl.sthitiBlock, env))
  }

  // Bind positional args to aagama field names (may overwrite same-named sthiti cells — aagama wins)
  for (let i = 0; i < decl.aagama.length; i++) {
    locals[decl.aagama[i].name] = args[i] ?? null
  }

  // Execute body statements in order
  for (const stmt of decl.body) {
    if (stmt.kind === 'assign') {
      locals[stmt.name] = evaluate(stmt.expr, locals, env)
    } else {
      // expr-stmt: evaluate for side effects, discard value
      evaluate(stmt.expr, locals, env)
    }
  }

  return locals
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

export function evaluate(expr: Expression, payload: Payload, env?: KriyaEnv): EvalValue {
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
      const l = evaluate(expr.left, payload, env)
      const r = evaluate(expr.right, payload, env)
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
      const l = evaluate(expr.left, payload, env)
      const r = evaluate(expr.right, payload, env)
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
      const v = evaluate(expr.operand, payload, env)
      if (v === null) return null
      return !v
    }

    case 'negate': {
      const v = evaluate(expr.operand, payload, env)
      if (v === null) return null
      return -(v as number)
    }

    case 'arith': {
      const l = evaluate(expr.left, payload, env)
      const r = evaluate(expr.right, payload, env)
      if (l === null || r === null) return null
      switch (expr.op) {
        case '+': return (l as number) + (r as number)
        case '-': return (l as number) - (r as number)
        case '*': return (l as number) * (r as number)
        case '/': return (r as number) === 0 ? null : (l as number) / (r as number)
        case '%': return (r as number) === 0 ? null : (l as number) % (r as number)
      }
    }

    case 'call': {
      if (!env) return null   // no env — avyakta (caller did not provide kriya context)
      const name = nameRefStr(expr.callee)
      const kriya = env.get(name)
      if (!kriya) return null  // unknown kriya — avyakta
      const args = expr.args.map(a => evaluate(a, payload, env))
      const result = evaluateKriya(kriya, args, env)
      // Single nirgama: return its value directly (the common case).
      // Multiple nirgama: return first. Full multi-return belongs with the process executor (Layer 4).
      if (kriya.nirgama.length >= 1) return result[kriya.nirgama[0].name] ?? null
      return null
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

export function evaluateGhatana(ghatana: GhatanaDecl, payload: Payload, env?: KriyaEnv): GhatanaResult {
  const vrtti  = ghatana.vrtti  ? toTarka(evaluate(ghatana.vrtti,  payload, env)) : undefined
  const karta  = ghatana.karta  ? evaluate(ghatana.karta,  payload, env) : undefined
  const sthala = ghatana.sthala ? evaluate(ghatana.sthala, payload, env) : undefined
  const kaarya = ghatana.kaarya ? evaluate(ghatana.kaarya, payload, env) : undefined

  // fires when vrtti is satya, or when no vrtti is declared (unconditional)
  const fires = vrtti === undefined || vrtti === 'satya'

  return { vrtti, karta, sthala, kaarya, fires }
}
