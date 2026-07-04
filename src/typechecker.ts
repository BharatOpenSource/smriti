import type {
  SmritiFile, SmritiDecl, SutraDecl,
  FlowDecl, FlowItem, PadaDecl, VibhagaDecl,
  TypedField, SmritiType, Pos,
  Expression, GhatanaDecl,
  KriyaDecl, SparshaDecl,
  SthitiBlock, IterateStmt, KriyaStmt,
  SevaDecl, SangrahaDecl, AavahaDecl,
} from './ast.js'
import { nameRefStr } from './ast.js'
import type { ResolveContext } from './resolver.js'

// Renders a SmritiType to a short human-readable string for error messages.
function typeStr(t: SmritiType): string {
  if (t.kind === 'krama')   return `krama[${typeStr(t.of)}]`
  if (t.kind === 'kosa')    return `kosa[${typeStr(t.key)}, ${typeStr(t.value)}]`
  if (t.kind === 'rachana') return `rachana[${t.fields.map(f => `${f.name} (${typeStr(f.type)})`).join(', ')}]`
  if (t.kind === 'sankhya' && (t.min !== undefined || t.max !== undefined)) {
    return `sankhya ${t.min ?? ''}..${t.max ?? ''}`
  }
  if (t.kind === 'vakya' && t.pattern !== undefined) return `vakya "${t.pattern}"`
  return t.kind
}

// Validates type constraints recursively (inner types of krama/kosa/rachana included).
function checkTypeConstraints(t: SmritiType, pos: Pos, fail: (msg: string, p: Pos) => void) {
  if (t.kind === 'sankhya') {
    if (t.min !== undefined && t.max !== undefined && t.min > t.max) {
      fail(`sankhya constraint: min (${t.min}) must not exceed max (${t.max})`, pos)
    }
  }
  if (t.kind === 'vakya' && t.pattern !== undefined) {
    try { new RegExp(t.pattern) } catch {
      fail(`vakya pattern is not a valid regular expression: ${t.pattern}`, pos)
    }
  }
  if (t.kind === 'krama') checkTypeConstraints(t.of, pos, fail)
  if (t.kind === 'kosa')  { checkTypeConstraints(t.key, pos, fail); checkTypeConstraints(t.value, pos, fail) }
  if (t.kind === 'rachana') {
    const seen = new Set<string>()
    for (const f of t.fields) {
      if (seen.has(f.name)) fail(`rachana: duplicate field '${f.name}'`, pos)
      seen.add(f.name)
      checkTypeConstraints(f.type, pos, fail)
    }
  }
}

export class TypecheckError extends Error {
  constructor(message: string, public pos: Pos) {
    super(`[${pos.line}:${pos.col}] ${message}`)
  }
}

// Collects all errors rather than stopping at the first one.
class Checker {
  errors: TypecheckError[] = []

  constructor(private context?: ResolveContext) {}

  fail(message: string, pos: Pos) {
    this.errors.push(new TypecheckError(message, pos))
  }

  checkFile(file: SmritiFile) {
    // Build a file-wide set of impure kriya names (those with sparsha blocks).
    // Used to enforce the pure-by-default guarantee: pure kriya cannot call impure ones.
    const impureKriya = this.collectImpureKriya(file)
    const kriyaNames = this.collectKriyaNames(file)
    const sangrahaDecls = this.collectSangrahaDecls(file)
    for (const decl of file.decls) {
      if (decl.kind === 'smriti')        this.checkSmriti(decl, impureKriya, sangrahaDecls)
      else if (decl.kind === 'sutra')    this.checkSutra(decl, impureKriya, sangrahaDecls)
      else if (decl.kind === 'kriya')    this.checkKriya(decl, impureKriya)
      else if (decl.kind === 'seva')     this.checkSeva(decl)
      else if (decl.kind === 'sangraha') this.checkSangraha(decl, kriyaNames)
    }
  }

  private collectSangrahaDecls(file: SmritiFile): Map<string, SangrahaDecl> {
    const map = new Map<string, SangrahaDecl>()
    for (const decl of file.decls) {
      if (decl.kind === 'sangraha') map.set(decl.name, decl)
    }
    return map
  }

  private collectKriyaNames(file: SmritiFile): Set<string> {
    const names = new Set<string>()
    for (const decl of file.decls) {
      if (decl.kind === 'kriya') names.add(decl.name)
      if (decl.kind === 'smriti' || decl.kind === 'sutra') {
        for (const k of decl.kriya) names.add(k.name)
      }
    }
    return names
  }

  // Collects all kriya names that have a sparsha block (top-level + scoped).
  private collectImpureKriya(file: SmritiFile): Set<string> {
    const names = new Set<string>()
    for (const decl of file.decls) {
      if (decl.kind === 'kriya' && decl.sparsha) names.add(decl.name)
      if (decl.kind === 'smriti' || decl.kind === 'sutra') {
        for (const k of decl.kriya) if (k.sparsha) names.add(k.name)
      }
    }
    return names
  }

  private checkSmriti(decl: SmritiDecl, impureKriya: Set<string>, sangrahaDecls: Map<string, SangrahaDecl>) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    const participantNames = new Set(decl.participants.map(p => p.name))
    for (const p of decl.participants) this.checkIti(p.name, p.itiName, p.pos)
    if (decl.aagama)  this.checkTypedFields(decl.aagama)
    if (decl.nirgama) this.checkTypedFields(decl.nirgama)
    // Smriti-level aagama are process inputs from the caller — pre-seeded as produced.
    const externalInputs = new Map<string, SmritiType>()
    if (decl.aagama) for (const f of decl.aagama) externalInputs.set(f.name, f.type)
    for (const k of decl.kriya) this.checkKriya(k, impureKriya)
    if (decl.sthitiBlock) this.checkSthitiBlock(decl.sthitiBlock)
    if (decl.trigger) this.checkGhatana(decl.trigger, externalInputs)
    if (decl.flow) this.checkFlow(decl.flow, participantNames, externalInputs, false, sangrahaDecls)
  }

  private checkGhatana(ghatana: GhatanaDecl, aagamaFields: Map<string, SmritiType>) {
    const aagamaNames = new Set(aagamaFields.keys())
    const checkGhatanaExpr = (expr: Expression, fieldName: string) => {
      this.checkExpression(expr)
      // identifiers in ghatana expressions must refer to aagama field names
      const checkIds = (e: Expression): void => {
        if (e.kind === 'identifier' && !aagamaNames.has(e.name)) {
          this.fail(
            `ghatana ${fieldName}: '${e.name}' is not an aagama field — ` +
            `available: ${[...aagamaNames].join(', ') || '(none)'}`,
            e.pos,
          )
        }
        if (e.kind === 'compare' || e.kind === 'logical') {
          checkIds(e.left); checkIds(e.right)
        }
        if (e.kind === 'not') checkIds(e.operand)
      }
      checkIds(expr)
    }
    if (ghatana.vrtti)  checkGhatanaExpr(ghatana.vrtti,  'vrtti')
    // karta/sthala/kaarya are descriptive context, not data predicates —
    // identifiers may refer to participants or literals; no aagama constraint.
    if (ghatana.karta)  this.checkExpression(ghatana.karta)
    if (ghatana.sthala) this.checkExpression(ghatana.sthala)
    if (ghatana.kaarya) this.checkExpression(ghatana.kaarya)
  }

  private checkSutra(decl: SutraDecl, impureKriya: Set<string>, sangrahaDecls: Map<string, SangrahaDecl>) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    if (decl.aagama)  this.checkTypedFields(decl.aagama)
    if (decl.nirgama) this.checkTypedFields(decl.nirgama)
    // Seed sutra-level aagama as external inputs to the flow (mirrors smriti treatment).
    const externalInputs = new Map<string, SmritiType>()
    if (decl.aagama) for (const f of decl.aagama) externalInputs.set(f.name, f.type)
    // aadesha steps must reference a pada that exists in the flow (no parent context here —
    // full inheritance check runs only when the merged sutra is assembled by the resolver).
    for (const k of decl.kriya) this.checkKriya(k, impureKriya)
    if (decl.sthitiBlock) this.checkSthitiBlock(decl.sthitiBlock)
    for (const item of decl.flow.items) {
      if (item.kind === 'aadesha') this.checkPada(item.pada, new Set(), new Set(), new Map())
    }
    this.checkFlow(decl.flow, new Set(), externalInputs, false, sangrahaDecls)
  }

  // ─── Expression types ─────────────────────────────────────────────────────
  // Simple type categories — used only for compatibility checking.
  // 'unknown' means an unresolved identifier: passes all checks (data flow validates later).

  private exprType(expr: Expression): 'tarka' | 'number' | 'string' | 'unknown' {
    switch (expr.kind) {
      case 'tarka-literal':  return 'tarka'
      case 'number-literal': return 'number'
      case 'string-literal': return 'string'
      case 'identifier':     return 'unknown'   // resolved in data-flow pass
      case 'compare':        return 'tarka'     // comparison always yields tarka
      case 'logical':        return 'tarka'
      case 'not':            return 'tarka'
      case 'negate':         return 'number'
      case 'arith':
        // '+' between strings is concatenation, not addition.
        return expr.op === '+' && (this.exprType(expr.left) === 'string' || this.exprType(expr.right) === 'string')
          ? 'string' : 'number'
      case 'call':           return 'unknown'   // resolved when kriya typechecker runs
      case 'member':         return 'unknown'   // rachana field type not tracked at this pass
      case 'ternary': {
        const tt = this.exprType(expr.then)
        const et = this.exprType(expr.else)
        return tt === et ? tt : 'unknown'
      }
    }
  }

  private checkExpression(expr: Expression): void {
    switch (expr.kind) {
      case 'tarka-literal':
      case 'number-literal':
      case 'string-literal':
      case 'identifier':
        return   // primitives are always valid

      case 'not':
        this.checkExpression(expr.operand)
        if (this.exprType(expr.operand) === 'number' || this.exprType(expr.operand) === 'string') {
          this.fail(`'!' applied to ${this.exprType(expr.operand)} — expected a tarka expression`, expr.pos)
        }
        return

      case 'logical': {
        this.checkExpression(expr.left)
        this.checkExpression(expr.right)
        const lt = this.exprType(expr.left)
        const rt = this.exprType(expr.right)
        if (lt !== 'tarka' && lt !== 'unknown') {
          this.fail(`left side of '${expr.op}' is ${lt} — expected tarka or boolean expression`, expr.left.pos)
        }
        if (rt !== 'tarka' && rt !== 'unknown') {
          this.fail(`right side of '${expr.op}' is ${rt} — expected tarka or boolean expression`, expr.right.pos)
        }
        return
      }

      case 'compare': {
        this.checkExpression(expr.left)
        this.checkExpression(expr.right)
        const lt = this.exprType(expr.left)
        const rt = this.exprType(expr.right)
        // Numeric ordering operators require numeric operands
        const orderedOps = ['<', '>', '<=', '>='] as const
        if (orderedOps.includes(expr.op as typeof orderedOps[number])) {
          if (lt === 'string' || rt === 'string') {
            this.fail(
              `'${expr.op}' requires numeric operands — got string`,
              expr.pos,
            )
          }
        }
        // Equality operators: operand types should agree (or one is unknown)
        if (lt !== 'unknown' && rt !== 'unknown' && lt !== rt) {
          this.fail(
            `type mismatch in '${expr.op}': ${lt} vs ${rt}`,
            expr.pos,
          )
        }
        return
      }

      case 'negate': {
        this.checkExpression(expr.operand)
        const t = this.exprType(expr.operand)
        if (t === 'tarka' || t === 'string') {
          this.fail(`unary '-' applied to ${t} — expected numeric expression`, expr.pos)
        }
        return
      }

      case 'arith': {
        this.checkExpression(expr.left)
        this.checkExpression(expr.right)
        const lt = this.exprType(expr.left)
        const rt = this.exprType(expr.right)

        // '+' between strings is concatenation — only reject a concrete numeric/tarka
        // operand paired with a concrete string operand (a real mismatch, not addition).
        if (expr.op === '+' && (lt === 'string' || rt === 'string')) {
          if (lt === 'number' || lt === 'tarka') {
            this.fail(`left side of '+' is ${lt} but right side is string — mismatched types for concatenation`, expr.left.pos)
          }
          if (rt === 'number' || rt === 'tarka') {
            this.fail(`right side of '+' is ${rt} but left side is string — mismatched types for concatenation`, expr.right.pos)
          }
          return
        }

        if (lt === 'tarka' || lt === 'string') {
          this.fail(`left side of '${expr.op}' is ${lt} — expected numeric expression`, expr.left.pos)
        }
        if (rt === 'tarka' || rt === 'string') {
          this.fail(`right side of '${expr.op}' is ${rt} — expected numeric expression`, expr.right.pos)
        }
        return
      }

      case 'call': {
        // Arg expressions are type-checked. Callee resolution deferred to kriya phase (Layer 1).
        for (const arg of expr.args) this.checkExpression(arg)
        return
      }

      case 'member':
        // object is always an identifier or nested member — rachana field types aren't
        // tracked at this pass (mirrors 'identifier'/'call' — deferred to data-flow/runtime).
        this.checkExpression(expr.object)
        return

      case 'ternary': {
        this.checkExpression(expr.condition)
        const ct = this.exprType(expr.condition)
        if (ct === 'number' || ct === 'string') {
          this.fail(`ternary condition is ${ct} — expected a tarka expression`, expr.condition.pos)
        }
        this.checkExpression(expr.then)
        this.checkExpression(expr.else)
        return
      }
    }
  }

  private checkIti(blockName: string, itiName: string | undefined, pos: Pos) {
    if (itiName !== undefined && itiName !== blockName) {
      this.fail(
        `iti name '${itiName}' does not match block name '${blockName}'`,
        pos,
      )
    }
  }

  // ─── Flow ──────────────────────────────────────────────────────────────────

  // isParallelTrack: when true (anubhaga inner track), skip terminal check and data flow.
  // Terminal semantics don't apply to tracks — they exit via anugama.
  // Data flow is handled by the outer checkDataFlow with full outer context.
  private checkFlow(flow: FlowDecl, participants: Set<string>, externalInputs?: Map<string, SmritiType>, isParallelTrack = false, sangrahaDecls: Map<string, SangrahaDecl> = new Map()) {
    const stepNames = this.collectStepNames(flow)
    const stepByName = this.collectStepByName(flow)
    this.checkStepUniqueness(flow)

    for (const item of flow.items) {
      this.checkFlowItem(item, stepNames, participants, stepByName, sangrahaDecls)
    }

    if (!isParallelTrack) {
      // A non-empty flow must reach a terminal (svasti or anaapta) on every path.
      // Full path analysis is deferred — warn if no terminal exists at all.
      const hasTerminal = flow.items.some(
        i => i.kind === 'svasti' || i.kind === 'anaapta' ||
             i.kind === 'vibhaga'
      )
      if (flow.items.length > 0 && !hasTerminal) {
        this.fail(
          'pravah has no terminal (svasti or anaapta) and no vibhaga routing',
          flow.pos,
        )
      }

      // Data flow: validate aagama/nirgama connections and vibhaga field references.
      this.checkDataFlow(flow.items, externalInputs)
    }
  }

  // ─── Data flow ─────────────────────────────────────────────────────────────
  // Flat analysis: collects all nirgama fields from all steps (not path-sensitive).
  // A field on any branch is considered available. Path-sensitive analysis is future.

  private collectProduced(items: FlowItem[], seed?: Map<string, SmritiType>): Map<string, SmritiType> {
    const map = new Map<string, SmritiType>(seed)
    for (const item of items) {
      if (item.kind === 'pada') {
        for (const f of item.nirgama) map.set(f.name, f.type)
      }
      if (item.kind === 'aadesha') {
        for (const f of item.pada.nirgama) map.set(f.name, f.type)
      }
      if (item.kind === 'varna') {
        map.set(item.name, item.varnaType)
      }
      if (item.kind === 'aavaha') {
        for (const f of item.nirgama) map.set(f.name, f.type)
      }
      if (item.kind === 'anubhaga') {
        for (const track of item.tracks) {
          for (const [k, v] of this.collectProduced(track)) map.set(k, v)
        }
      }
    }
    return map
  }

  private typesMatch(a: SmritiType, b: SmritiType): boolean {
    if (a.kind !== b.kind) return false
    if (a.kind === 'krama' && b.kind === 'krama') return this.typesMatch(a.of, b.of)
    if (a.kind === 'kosa'  && b.kind === 'kosa')  return this.typesMatch(a.key, b.key) && this.typesMatch(a.value, b.value)
    if (a.kind === 'rachana' && b.kind === 'rachana') {
      if (a.fields.length !== b.fields.length) return false
      return a.fields.every((f, i) => f.name === b.fields[i].name && this.typesMatch(f.type, b.fields[i].type))
    }
    return true
  }

  private checkDataFlow(items: FlowItem[], externalInputs?: Map<string, SmritiType>) {
    const produced = this.collectProduced(items, externalInputs)
    if (produced.size === 0) return  // no typed fields — nothing to validate

    for (const item of items) {
      if (item.kind === 'pada') {
        for (const f of item.aagama) {
          const producedType = produced.get(f.name)
          if (producedType === undefined) {
            this.fail(
              `aagama '${f.name}' is not produced by any step — ` +
              `available: ${[...produced.keys()].join(', ')}`,
              item.pos,
            )
          } else if (!this.typesMatch(f.type, producedType)) {
            this.fail(
              `aagama '${f.name}': declared as ${typeStr(f.type)} but produced as ${typeStr(producedType)}`,
              item.pos,
            )
          }
        }
      }

      if (item.kind === 'vibhaga' && item.on) {
        if (!produced.has(item.on)) {
          this.fail(
            `vibhaga '${item.on}' references field not produced by any step — ` +
            `available: ${[...produced.keys()].join(', ')}`,
            item.pos,
          )
        }
      }

      if (item.kind === 'anubhaga') {
        // Pass outer produced context so tracks can consume fields from steps before the split.
        for (const track of item.tracks) this.checkDataFlow(track, produced)
      }
    }
  }

  private collectStepNames(flow: FlowDecl): Set<string> {
    const names = new Set<string>()
    const collect = (items: FlowItem[]) => {
      for (const item of items) {
        if (item.kind === 'pada')    names.add(item.name)
        if (item.kind === 'varna')   names.add(item.name)    // varna produces a named field
        if (item.kind === 'aadesha') names.add(item.target)  // aadesha counts as that step name
        if (item.kind === 'sthiti') names.add(item.name)
        if (item.kind === 'anubhaga') {
          for (const track of item.tracks) collect(track)
        }
      }
    }
    collect(flow.items)
    return names
  }

  // Maps step name → PadaDecl for cross-step aagama coverage checks.
  private collectStepByName(flow: FlowDecl): Map<string, PadaDecl> {
    const map = new Map<string, PadaDecl>()
    const collect = (items: FlowItem[]) => {
      for (const item of items) {
        if (item.kind === 'pada') map.set(item.name, item)
        if (item.kind === 'anubhaga') {
          for (const track of item.tracks) collect(track)
        }
      }
    }
    collect(flow.items)
    return map
  }

  private checkStepUniqueness(flow: FlowDecl) {
    const seen = new Map<string, Pos>()
    for (const item of flow.items) {
      if (item.kind !== 'pada') continue
      if (seen.has(item.name)) {
        this.fail(
          `Duplicate step name '${item.name}' — first declared at line ${seen.get(item.name)!.line}`,
          item.pos,
        )
      } else {
        seen.set(item.name, item.pos)
      }
    }
  }

  private checkFlowItem(item: FlowItem, stepNames: Set<string>, participants: Set<string>, stepByName: Map<string, PadaDecl>, sangrahaDecls: Map<string, SangrahaDecl> = new Map()) {
    switch (item.kind) {
      case 'pada':     return this.checkPada(item, stepNames, participants, stepByName)
      case 'aadesha':  return this.checkPada(item.pada, stepNames, participants, stepByName)
      case 'varna':    return this.checkVarna(item)
      case 'vibhaga':  return this.checkVibhaga(item, stepNames)
      case 'anubhaga': {
        for (const track of item.tracks) {
          const inner = { kind: 'pravah' as const, items: track, pos: item.pos }
          // isParallelTrack=true: skip terminal check and data flow (handled by outer checkDataFlow with context)
          this.checkFlow(inner, participants, undefined, true, sangrahaDecls)
        }
        return
      }
      case 'svasti':
      case 'anaapta':
      case 'sthiti':
        return
      case 'anugama': {
        for (const name of item.tracks) {
          if (!stepNames.has(name)) {
            this.fail(
              `anugama references '${name}' which is not a step in any parallel track — ` +
              `check that '${name}' is a pada declared inside an anubhaga block`,
              item.pos,
            )
          }
        }
        return
      }
      case 'aavaha': {
        const t = item.target
        // bare name (e.g. aavaha payment-gateway) is an external service reference — not validated against local steps
        if (typeof t !== 'string') {
          const store = sangrahaDecls.get(t.namespace)
          if (store) {
            // aavaha store.op — dispatch to a sangraha (persistent store) operation
            this.checkSangrahaAavaha(item, t.name, store)
          } else {
            // qualified aavaha: gov.pan-verification — validate namespace is imported
            const ns = this.context?.imports.get(t.namespace)
            if (!ns) {
              this.fail(
                `aavaha namespace '${t.namespace}' is not imported — ` +
                `add: sangama ${t.namespace} { yuja: "./file.smr" }`,
                item.pos,
              )
            }
          }
        }
        return
      }
    }
  }

  // ─── Step ──────────────────────────────────────────────────────────────────

  private checkPada(pada: PadaDecl, stepNames: Set<string>, participants: Set<string>, stepByName: Map<string, PadaDecl>) {
    this.checkIti(pada.name, pada.itiName, pada.pos)

    if (pada.karta !== undefined) {
      if (typeof pada.karta === 'string') {
        if (participants.size > 0 && !participants.has(pada.karta)) {
          this.fail(
            `karta '${pada.karta}' is not a declared paksha — declared: ${[...participants].join(', ')}`,
            pada.pos,
          )
        }
      } else {
        const qn = pada.karta
        const ns = this.context?.imports.get(qn.namespace)
        if (!ns) {
          this.fail(
            `karta namespace '${qn.namespace}' is not imported — ` +
            `add: sangama ${qn.namespace} { yuja: "./file.smr" }`,
            pada.pos,
          )
        } else if (!ns.participants.some(p => p.name === qn.name)) {
          this.fail(
            `karta '${nameRefStr(qn)}' not found in namespace '${qn.namespace}' — ` +
            `available: ${ns.participants.map(p => `${ns.namespace}.${p.name}`).join(', ')}`,
            pada.pos,
          )
        }
      }
    }

    // apavaada: per-step failure target must exist in the flow
    if (pada.apavaada !== undefined) {
      const vt = pada.apavaada
      if (vt !== 'svasti' && vt !== 'anaapta' && !stepNames.has(vt)) {
        this.fail(
          `apavaada target '${vt}' does not exist in this pravah`,
          pada.pos,
        )
      }
    }

    // samapti: SLA timeout routing requires samaya on the same step
    if (pada.samapti !== undefined) {
      if (!pada.samaya) {
        this.fail(
          `samapti declared on '${pada.name}' but no samaya (SLA) is set — timeout routing requires a time limit`,
          pada.pos,
        )
      }
      const kt = pada.samapti
      if (kt !== 'svasti' && kt !== 'anaapta' && !stepNames.has(kt)) {
        this.fail(
          `samapti target '${kt}' does not exist in this pravah`,
          pada.pos,
        )
      }
    }

    // pravritti / prativritti targets must exist
    if (pada.routing) {
      const target = pada.routing.target
      if (!stepNames.has(target)) {
        this.fail(
          `${pada.routing.kind} target '${target}' does not exist in this pravah`,
          pada.routing.pos,
        )
      }
    }

    // Guard clause type-check
    if (pada.khanda) this.checkExpression(pada.khanda)

    if (pada.aagama) this.checkTypedFields(pada.aagama)
    if (pada.nirgama) this.checkTypedFields(pada.nirgama)

    // Error/timeout data fields — validate that they're well-typed, then check handler coverage
    if (pada.apavaadaNirgama) {
      if (!pada.apavaada) {
        this.fail(`apavaada data declared on '${pada.name}' but no apavaada routing — add: apavaada → handler`, pada.pos)
      }
      this.checkTypedFields(pada.apavaadaNirgama)
      if (pada.apavaada) {
        this.checkHandlerCoverage(pada.name, 'apavaada', pada.apavaada, pada.apavaadaNirgama, stepByName, pada.pos)
      }
    }
    if (pada.samaptiNirgama) {
      if (!pada.samapti) {
        this.fail(`samapti data declared on '${pada.name}' but no samapti routing — add: samapti → handler`, pada.pos)
      }
      this.checkTypedFields(pada.samaptiNirgama)
      if (pada.samapti) {
        this.checkHandlerCoverage(pada.name, 'samapti', pada.samapti, pada.samaptiNirgama, stepByName, pada.pos)
      }
    }
  }

  // Validates that a handler step's aagama covers all fields produced by the source step's
  // apavaada/samapti nirgama. Skips terminals (svasti/anaapta) and unknown steps (caught elsewhere).
  private checkHandlerCoverage(
    sourceName: string,
    routeKind: 'apavaada' | 'samapti',
    handlerName: string,
    producedFields: TypedField[],
    stepByName: Map<string, PadaDecl>,
    pos: Pos,
  ) {
    if (handlerName === 'svasti' || handlerName === 'anaapta') return
    const handler = stepByName.get(handlerName)
    if (!handler) return  // non-existent target already caught by the target-exists check

    const handlerAagama = handler.aagama ?? []
    for (const produced of producedFields) {
      const declared = handlerAagama.find(f => f.name === produced.name)
      if (!declared) {
        this.fail(
          `handler '${handlerName}' receives ${routeKind} from '${sourceName}' ` +
          `but does not declare field '${produced.name}' in its aagama`,
          pos,
        )
      } else if (!this.typesMatch(declared.type, produced.type)) {
        this.fail(
          `handler '${handlerName}' declares '${produced.name}' as ${typeStr(declared.type)} ` +
          `but '${sourceName}' ${routeKind} produces it as ${typeStr(produced.type)}`,
          pos,
        )
      }
    }
  }

  private checkVarna(varna: import('./ast.js').VarnaDecl) {
    this.checkType(varna.varnaType, varna.pos)
    if (varna.expr) this.checkExpression(varna.expr)
  }

  // ─── Branching ─────────────────────────────────────────────────────────────

  private checkVibhaga(vibhaga: VibhagaDecl, stepNames: Set<string>) {
    if (vibhaga.itiName) this.checkIti(vibhaga.on, vibhaga.itiName, vibhaga.pos)

    for (const clause of vibhaga.clauses) {
      // Type-check condition expression
      this.checkExpression(clause.condition)
      // Branch target must exist
      const target = clause.target
      if (target !== 'svasti' && target !== 'anaapta' && !stepNames.has(target)) {
        this.fail(
          `niyama target '${target}' does not exist in this pravah`,
          clause.pos,
        )
      }
    }

    // When ALL conditions are tarka literals, require all three cases (exhaustiveness).
    // Mixed expressions (comparisons, identifiers) skip this check.
    const allTarka = vibhaga.clauses.every(c => c.condition.kind === 'tarka-literal')
    if (allTarka && vibhaga.clauses.length > 0) {
      const covered = new Set(vibhaga.clauses.map(c => (c.condition as { value: string }).value))
      const missing = (['satya', 'asatya', 'avyakta'] as const).filter(v => !covered.has(v))
      if (missing.length > 0) {
        this.fail(
          `vibhaga '${vibhaga.on}' on tarka is missing cases: ${missing.join(', ')} — avyakta must always be handled`,
          vibhaga.pos,
        )
      }
    }
  }

  // ─── Computation (kriya) ──────────────────────────────────────────────────

  private checkKriya(decl: KriyaDecl, impureKriya: Set<string> = new Set()) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    this.checkTypedFields(decl.aagama)
    this.checkTypedFields(decl.nirgama)
    if (decl.sparsha) this.checkSparsha(decl.sparsha)
    if (decl.sthitiBlock) this.checkSthitiBlock(decl.sthitiBlock)

    // A kriya without sparsha is pure. Track whether this one is impure.
    const thisIsPure = !decl.sparsha

    // Names available in the body: aagama inputs + sthiti cells (pre-initialised), then assigns.
    const fieldTypes = new Map<string, SmritiType>()
    for (const f of decl.aagama) fieldTypes.set(f.name, f.type)
    if (decl.sthitiBlock) for (const f of decl.sthitiBlock.fields) fieldTypes.set(f.name, f.type)
    const produced = new Set<string>(fieldTypes.keys())

    this.checkKriyaBody(decl.body, produced, fieldTypes, decl.name, thisIsPure, impureKriya)

    // Every required nirgama field must be assigned at least once in the body.
    for (const f of decl.nirgama) {
      if (!f.optional && !produced.has(f.name)) {
        this.fail(
          `nirgama '${f.name}' (${typeStr(f.type)}) is never assigned in kriya '${decl.name}'`,
          decl.pos,
        )
      }
    }
  }

  // Type-checks a straight-line statement list (a kriya body, or a kramana loop body).
  // Mutates `produced` with every assign target seen so callers can check nirgama coverage.
  private checkKriyaBody(
    stmts: KriyaStmt[],
    produced: Set<string>,
    fieldTypes: Map<string, SmritiType>,
    callerName: string,
    callerIsPure: boolean,
    impureKriya: Set<string>,
  ) {
    for (const stmt of stmts) {
      if (stmt.kind === 'assign') {
        this.checkExprPurity(stmt.expr, callerName, callerIsPure, impureKriya)
        produced.add(stmt.name)
      } else if (stmt.kind === 'expr-stmt') {
        this.checkExprPurity(stmt.expr, callerName, callerIsPure, impureKriya)
      } else {
        this.checkIterate(stmt, produced, fieldTypes, callerName, callerIsPure, impureKriya)
      }
    }
  }

  // kramana item : collection { body } — collection must be a krama or kosa field already
  // in scope; bindings are bound to the element type(s) for the loop body only. Assignments
  // inside the body to names that existed before the loop (an accumulator) propagate back
  // out — the loop bindings themselves do not.
  private checkIterate(
    stmt: IterateStmt,
    produced: Set<string>,
    fieldTypes: Map<string, SmritiType>,
    callerName: string,
    callerIsPure: boolean,
    impureKriya: Set<string>,
  ) {
    if (!produced.has(stmt.collection)) {
      this.fail(
        `kramana: '${stmt.collection}' is not a declared aagama/sthiti field — ` +
        `available: ${[...produced].join(', ') || '(none)'}`,
        stmt.pos,
      )
      return
    }

    const collectionType = fieldTypes.get(stmt.collection)
    const innerTypes = new Map(fieldTypes)

    if (collectionType === undefined) {
      // Bound by a prior assign with no tracked declared type — allow; loop bindings stay untyped.
    } else if (collectionType.kind === 'krama') {
      if (stmt.bindings.length !== 1) {
        this.fail(
          `kramana over krama '${stmt.collection}' takes exactly one binding, got ${stmt.bindings.length}`,
          stmt.pos,
        )
      } else {
        innerTypes.set(stmt.bindings[0], collectionType.of)
      }
    } else if (collectionType.kind === 'kosa') {
      if (stmt.bindings.length !== 2) {
        this.fail(
          `kramana over kosa '${stmt.collection}' takes exactly two bindings (key, value), got ${stmt.bindings.length}`,
          stmt.pos,
        )
      } else {
        innerTypes.set(stmt.bindings[0], collectionType.key)
        innerTypes.set(stmt.bindings[1], collectionType.value)
      }
    } else {
      this.fail(
        `kramana: '${stmt.collection}' is ${typeStr(collectionType)} — must be krama or kosa`,
        stmt.pos,
      )
    }

    const innerProduced = new Set(produced)
    for (const b of stmt.bindings) innerProduced.add(b)

    this.checkKriyaBody(stmt.body, innerProduced, innerTypes, callerName, callerIsPure, impureKriya)

    for (const name of innerProduced) {
      if (!stmt.bindings.includes(name)) produced.add(name)
    }
  }

  // checkExprPurity: type-checks an expression AND, when inside a pure kriya,
  // rejects calls to impure kriya (those with sparsha blocks).
  private checkExprPurity(expr: Expression, callerName: string, callerIsPure: boolean, impureKriya: Set<string>) {
    this.checkExpression(expr)
    if (callerIsPure && expr.kind === 'call') {
      const callee = typeof expr.callee === 'string' ? expr.callee : expr.callee.name
      if (impureKriya.has(callee)) {
        this.fail(
          `pure kriya '${callerName}' calls impure kriya '${callee}' — ` +
          `add a sparsha block to '${callerName}' to declare its effects`,
          expr.pos,
        )
      }
      // Recurse into args (they may contain nested calls)
      for (const arg of expr.args) this.checkExprPurity(arg, callerName, callerIsPure, impureKriya)
      return
    }
    // For non-call expressions, recurse into sub-expressions for purity checking
    if (expr.kind === 'compare' || expr.kind === 'logical' || expr.kind === 'arith') {
      this.checkExprPurity(expr.left, callerName, callerIsPure, impureKriya)
      this.checkExprPurity(expr.right, callerName, callerIsPure, impureKriya)
    }
    if (expr.kind === 'not' || expr.kind === 'negate') {
      this.checkExprPurity(expr.operand, callerName, callerIsPure, impureKriya)
    }
    if (expr.kind === 'ternary') {
      this.checkExprPurity(expr.condition, callerName, callerIsPure, impureKriya)
      this.checkExprPurity(expr.then, callerName, callerIsPure, impureKriya)
      this.checkExprPurity(expr.else, callerName, callerIsPure, impureKriya)
    }
  }

  private checkSparsha(decl: SparshaDecl) {
    const CHANNELS = new Set(['http', 'file', 'event'])
    const MODES    = new Set(['read', 'write', 'emit', 'read-write'])
    for (const f of decl.fields) {
      if (!CHANNELS.has(f.channel)) {
        this.fail(`unknown effect channel '${f.channel}' — valid: http, file, event`, f.pos)
      }
      if (!MODES.has(f.mode)) {
        this.fail(`unknown effect mode '${f.mode}' — valid: read, write, emit, read-write`, f.pos)
      }
    }
  }

  // ─── State (sthiti-block) ─────────────────────────────────────────────────

  // Maps a SmritiType to the coarse expression-type category used by exprType().
  private smritiTypeCategory(t: SmritiType): 'tarka' | 'number' | 'string' | 'complex' {
    switch (t.kind) {
      case 'sankhya': case 'bhinnaanka': case 'dashaamsha': return 'number'
      case 'vakya':   return 'string'
      case 'tarka':   return 'tarka'
      default:        return 'complex'   // tithi, antara, patra, krama, kosa — skip init check
    }
  }

  private checkSthitiBlock(block: SthitiBlock) {
    const seen = new Set<string>()
    for (const f of block.fields) {
      if (seen.has(f.name)) {
        this.fail(`Duplicate sthiti field '${f.name}'`, f.pos)
      }
      seen.add(f.name)
      this.checkType(f.type, f.pos)
      if (f.init) {
        this.checkExpression(f.init)
        const exprCat  = this.exprType(f.init)
        const fieldCat = this.smritiTypeCategory(f.type)
        // Only flag if both sides are concrete and they disagree.
        if (exprCat !== 'unknown' && fieldCat !== 'complex' && exprCat !== fieldCat) {
          this.fail(
            `sthiti '${f.name}': init value is ${exprCat} but field type is ${typeStr(f.type)}`,
            f.pos,
          )
        }
      }
    }
  }

  // ─── Types ─────────────────────────────────────────────────────────────────

  private checkTypedFields(fields: TypedField[]) {
    const seen = new Set<string>()
    for (const field of fields) {
      if (seen.has(field.name)) {
        this.fail(`Duplicate field name '${field.name}'`, field.pos)
      }
      seen.add(field.name)
      this.checkType(field.type, field.pos)
    }
  }

  private checkType(type: SmritiType, pos: Pos) {
    checkTypeConstraints(type, pos, (msg, p) => this.fail(msg, p))
    if (type.kind === 'kosa') {
      // kosa keys must be a scalar type
      if (type.key.kind === 'krama' || type.key.kind === 'kosa') {
        this.fail(`kosa key type must be a scalar, not a collection`, pos)
      }
    }
  }

  private checkSangraha(decl: SangrahaDecl, kriyaNames: Set<string>) {
    if (!decl.mukhya) {
      this.fail(`sangraha '${decl.name}': mukhya (primary key) is required`, decl.pos)
    } else {
      const k = decl.mukhya.type.kind
      if (k === 'krama' || k === 'kosa' || k === 'patra') {
        this.fail(
          `sangraha '${decl.name}': mukhya '${decl.mukhya.name}' must be a scalar type — ` +
          `${typeStr(decl.mukhya.type)} is a collection`,
          decl.mukhya.pos,
        )
      }
      this.checkType(decl.mukhya.type, decl.mukhya.pos)
    }
    const seen = new Set<string>()
    for (const f of decl.vivara) {
      if (seen.has(f.name)) {
        this.fail(`sangraha '${decl.name}': duplicate field '${f.name}' in vivara`, f.pos)
      }
      seen.add(f.name)
      this.checkType(f.type, f.pos)
    }
    const ops: [string, string | undefined][] = [
      ['likha', decl.likha], ['pathana', decl.pathana],
      ['uddhaara', decl.uddhaara], ['lopa', decl.lopa],
    ]
    for (const [opName, kriyaName] of ops) {
      if (kriyaName !== undefined && !kriyaNames.has(kriyaName)) {
        this.fail(
          `sangraha '${decl.name}': ${opName} bound to '${kriyaName}' but no such kriya exists in this file`,
          decl.pos,
        )
      }
    }
  }

  // Validates `aavaha store.op { aagama ... nirgama ... }` — the Layer 6.2 flow wire-up.
  // op must be a bound sangraha operation; aagama/nirgama fields must match the store's
  // mukhya + vivara schema by name and type. pathana/lopa additionally require the mukhya
  // field in aagama since they operate on one identified record.
  private checkSangrahaAavaha(item: AavahaDecl, opName: string, store: SangrahaDecl) {
    const validOps = ['likha', 'pathana', 'uddhaara', 'lopa'] as const
    if (!(validOps as readonly string[]).includes(opName)) {
      this.fail(
        `aavaha '${store.name}.${opName}': not a valid sangraha operation — ` +
        `use one of ${validOps.join(', ')}`,
        item.pos,
      )
      return
    }
    const op = opName as typeof validOps[number]
    const boundKriya = store[op]
    if (boundKriya === undefined) {
      this.fail(
        `aavaha '${store.name}.${op}': sangraha '${store.name}' has no ${op} operation bound`,
        item.pos,
      )
      return
    }

    const schema = new Map<string, SmritiType>()
    if (store.mukhya) schema.set(store.mukhya.name, store.mukhya.type)
    for (const f of store.vivara) schema.set(f.name, f.type)

    const checkFields = (fields: TypedField[], label: 'aagama' | 'nirgama') => {
      for (const f of fields) {
        const expected = schema.get(f.name)
        if (expected === undefined) {
          this.fail(
            `aavaha '${store.name}.${op}' ${label} '${f.name}' is not a field on sangraha '${store.name}' — ` +
            `available: ${[...schema.keys()].join(', ') || '(none)'}`,
            f.pos,
          )
        } else if (!this.typesMatch(f.type, expected)) {
          this.fail(
            `aavaha '${store.name}.${op}' ${label} '${f.name}': declared as ${typeStr(f.type)} but sangraha field is ${typeStr(expected)}`,
            f.pos,
          )
        }
      }
    }
    checkFields(item.aagama, 'aagama')
    checkFields(item.nirgama, 'nirgama')

    if ((op === 'pathana' || op === 'lopa') && store.mukhya) {
      const hasKey = item.aagama.some(f => f.name === store.mukhya!.name)
      if (!hasKey) {
        this.fail(
          `aavaha '${store.name}.${op}': aagama must include the mukhya field '${store.mukhya.name}' to identify the record`,
          item.pos,
        )
      }
    }
  }

  private checkSeva(decl: SevaDecl) {
    const validMethods = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
    if (!decl.method) {
      this.fail(`seva '${decl.name}': method is required — use GET, POST, PUT, PATCH, or DELETE`, decl.pos)
    } else if (!validMethods.has(decl.method)) {
      this.fail(`seva '${decl.name}': invalid method '${decl.method}' — use GET, POST, PUT, PATCH, or DELETE`, decl.pos)
    }
    if (!decl.path) {
      this.fail(`seva '${decl.name}': path is required`, decl.pos)
    } else if (!decl.path.startsWith('/')) {
      this.fail(`seva '${decl.name}': path must start with '/' (got '${decl.path}')`, decl.pos)
    }
    for (const f of decl.aagama) this.checkType(f.type, f.pos)
    for (const f of decl.nirgama) this.checkType(f.type, f.pos)
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function typecheck(file: SmritiFile, context?: ResolveContext): SmritiFile {
  const checker = new Checker(context)
  checker.checkFile(file)
  if (checker.errors.length > 0) {
    const messages = checker.errors.map(e => e.message).join('\n')
    throw new Error(`Type errors:\n${messages}`)
  }
  return file
}
