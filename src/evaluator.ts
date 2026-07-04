import type { Expression, KriyaDecl, KriyaStmt, IterateStmt, SmritiFile, SthitiBlock } from './ast.js'
import { nameRefStr } from './ast.js'

// ─── Value types ──────────────────────────────────────────────────────────────

// Arrays back krama values; plain objects back both kosa (string-keyed map) and
// rachana (named record) values — the two are only distinguished by static type,
// not by runtime shape.
export type EvalValue = number | string | boolean | null | EvalValue[] | { [key: string]: EvalValue }

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

// Default call budget for one root evaluateKriya/evaluate invocation — shared by reference
// across every nested call (including recursive self-calls) in that call tree, the same
// "flat step counter" model the process executor uses. A kriya has no conditional other
// than the ternary expression, so this is the only thing standing between a recursive
// kriya and an infinite JS call stack.
//
// Kept well below Node's default stack limit on purpose: each budget unit is one kriya
// call, but that unwinds through several real JS stack frames (evaluate → evaluateKriya →
// executeKriyaBody → evaluate(ternary) → evaluate(call) → ...), so a budget anywhere near
// the raw frame limit hits a real "Maximum call stack size exceeded" before our own
// (clearer) error fires. 1,000 leaves comfortable headroom across environments.
const DEFAULT_CALL_BUDGET = 1_000

export function evaluateKriya(decl: KriyaDecl, args: EvalValue[], env: KriyaEnv, budget: number[] = [DEFAULT_CALL_BUDGET]): Payload {
  const locals: Payload = {}

  // Seed sthiti initial state (kriya-local; re-initialised on each call)
  if (decl.sthitiBlock) {
    Object.assign(locals, buildInitialState(decl.sthitiBlock, env))
  }

  // Bind positional args to aagama field names (may overwrite same-named sthiti cells — aagama wins)
  for (let i = 0; i < decl.aagama.length; i++) {
    locals[decl.aagama[i].name] = args[i] ?? null
  }

  executeKriyaBody(decl.body, locals, env, budget)
  return locals
}

// Executes a straight-line statement list — a kriya body, or a kramana loop body —
// against a shared mutable `locals` payload. Reused so accumulator patterns
// (`total = total + item` inside a kramana loop) mutate the same locals the caller reads.
function executeKriyaBody(stmts: KriyaStmt[], locals: Payload, env: KriyaEnv, budget: number[]): void {
  for (const stmt of stmts) {
    if (stmt.kind === 'assign') {
      locals[stmt.name] = evaluate(stmt.expr, locals, env, budget)
    } else if (stmt.kind === 'expr-stmt') {
      evaluate(stmt.expr, locals, env, budget)
    } else {
      executeIterate(stmt, locals, env, budget)
    }
  }
}

// kramana item : collection { body } — one binding, collection is an array (krama).
// kramana key, value : collection { body } — two bindings, collection is an object (kosa).
// Loop bindings are removed from locals once the loop ends; anything else the body
// assigns (an accumulator that existed before the loop) stays, since locals is shared.
function executeIterate(stmt: IterateStmt, locals: Payload, env: KriyaEnv, budget: number[]): void {
  const collection = locals[stmt.collection]

  if (Array.isArray(collection)) {
    const [itemName] = stmt.bindings
    for (const item of collection) {
      locals[itemName] = item
      executeKriyaBody(stmt.body, locals, env, budget)
    }
    delete locals[itemName]
    return
  }

  if (collection !== null && typeof collection === 'object') {
    const [keyName, valueName] = stmt.bindings
    for (const [k, v] of Object.entries(collection)) {
      locals[keyName] = k
      locals[valueName] = v
      executeKriyaBody(stmt.body, locals, env, budget)
    }
    delete locals[keyName]
    delete locals[valueName]
  }
  // collection missing/null (avyakta) — zero iterations, not an error.
}

// ─── Evaluator ───────────────────────────────────────────────────────────────

// `budget` defaults to a fresh counter per top-level call so callers that never touch
// recursion (ghatana conditions, sthiti init, varna/khanda expressions) are unaffected —
// it's only consumed (and only matters) once a 'call' expression is actually evaluated.
export function evaluate(expr: Expression, payload: Payload, env?: KriyaEnv, budget: number[] = [DEFAULT_CALL_BUDGET]): EvalValue {
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
      const l = evaluate(expr.left, payload, env, budget)
      const r = evaluate(expr.right, payload, env, budget)
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
      const l = evaluate(expr.left, payload, env, budget)
      const r = evaluate(expr.right, payload, env, budget)
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
      const v = evaluate(expr.operand, payload, env, budget)
      if (v === null) return null
      return !v
    }

    case 'negate': {
      const v = evaluate(expr.operand, payload, env, budget)
      if (v === null) return null
      return -(v as number)
    }

    case 'arith': {
      const l = evaluate(expr.left, payload, env, budget)
      const r = evaluate(expr.right, payload, env, budget)
      if (l === null || r === null) return null
      switch (expr.op) {
        // '+' does double duty: numeric addition, or string concatenation when either
        // side is a string (the typechecker only allows this when both sides agree).
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
      const args = expr.args.map(a => evaluate(a, payload, env, budget))
      if (budget[0]-- <= 0) {
        throw new Error(`kriya call budget exceeded calling '${name}' — possible infinite recursion`)
      }
      const result = evaluateKriya(kriya, args, env, budget)
      // Single nirgama: return its value directly (the common case).
      // Multiple nirgama: return first. Full multi-return belongs with the process executor (Layer 4).
      if (kriya.nirgama.length >= 1) return result[kriya.nirgama[0].name] ?? null
      return null
    }

    case 'member': {
      const obj = evaluate(expr.object, payload, env, budget)
      if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return null
      const v = obj[expr.field]
      return v !== undefined ? v : null
    }

    case 'ternary': {
      const cond = evaluate(expr.condition, payload, env, budget)
      if (cond === true)  return evaluate(expr.then, payload, env, budget)
      if (cond === false) return evaluate(expr.else, payload, env, budget)
      return null   // avyakta condition — avyakta result
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
