import type {
  SmritiFile, SmritiDecl, SutraDecl,
  FlowDecl, FlowItem, PadaDecl, VibhagaDecl,
  TypedField, SmritiType, Pos,
  Expression, GhatanaDecl,
} from './ast.js'
import { nameRefStr } from './ast.js'
import type { ResolveContext } from './resolver.js'

// Renders a SmritiType to a short human-readable string for error messages.
function typeStr(t: SmritiType): string {
  if (t.kind === 'krama') return `krama[${typeStr(t.of)}]`
  if (t.kind === 'kosa')  return `kosa[${typeStr(t.key)}, ${typeStr(t.value)}]`
  if (t.kind === 'sankhya' && (t.min !== undefined || t.max !== undefined)) {
    return `sankhya ${t.min ?? ''}..${t.max ?? ''}`
  }
  if (t.kind === 'vakya' && t.pattern !== undefined) return `vakya "${t.pattern}"`
  return t.kind
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
    for (const decl of file.decls) {
      if (decl.kind === 'smriti') this.checkSmriti(decl)
      else this.checkSutra(decl)
    }
  }

  private checkSmriti(decl: SmritiDecl) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    const participantNames = new Set(decl.participants.map(p => p.name))
    for (const p of decl.participants) this.checkIti(p.name, p.itiName, p.pos)
    // Smriti-level aagama are process inputs from the caller — pre-seeded as produced.
    const externalInputs = new Map<string, SmritiType>()
    if (decl.aagama) for (const f of decl.aagama) externalInputs.set(f.name, f.type)
    if (decl.trigger) this.checkGhatana(decl.trigger, externalInputs)
    if (decl.flow) this.checkFlow(decl.flow, participantNames, externalInputs)
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

  private checkSutra(decl: SutraDecl) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    if (decl.aagama) this.checkTypedFields(decl.aagama)
    if (decl.nirgama) this.checkTypedFields(decl.nirgama)
    // aadesha steps must reference a pada that exists in the flow (no parent context here —
    // full inheritance check runs only when the merged sutra is assembled by the resolver).
    for (const item of decl.flow.items) {
      if (item.kind === 'aadesha') this.checkPada(item.pada, new Set(), new Set())
    }
    this.checkFlow(decl.flow, new Set())
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
  private checkFlow(flow: FlowDecl, participants: Set<string>, externalInputs?: Map<string, SmritiType>, isParallelTrack = false) {
    const stepNames = this.collectStepNames(flow)
    this.checkStepUniqueness(flow)

    for (const item of flow.items) {
      this.checkFlowItem(item, stepNames, participants)
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

  private checkFlowItem(item: FlowItem, stepNames: Set<string>, participants: Set<string>) {
    switch (item.kind) {
      case 'pada':     return this.checkPada(item, stepNames, participants)
      case 'aadesha':  return this.checkPada(item.pada, stepNames, participants)
      case 'vibhaga':  return this.checkVibhaga(item, stepNames)
      case 'anubhaga': {
        for (const track of item.tracks) {
          const inner = { kind: 'pravah' as const, items: track, pos: item.pos }
          // isParallelTrack=true: skip terminal check and data flow (handled by outer checkDataFlow with context)
          this.checkFlow(inner, participants, undefined, true)
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
        return
      }
    }
  }

  // ─── Step ──────────────────────────────────────────────────────────────────

  private checkPada(pada: PadaDecl, stepNames: Set<string>, participants: Set<string>) {
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
    if (type.kind === 'sankhya') {
      if (type.min !== undefined && type.max !== undefined && type.min > type.max) {
        this.fail(`sankhya constraint: min (${type.min}) must not exceed max (${type.max})`, pos)
      }
    }
    if (type.kind === 'vakya' && type.pattern !== undefined) {
      try { new RegExp(type.pattern) } catch {
        this.fail(`vakya pattern is not a valid regular expression: ${type.pattern}`, pos)
      }
    }
    if (type.kind === 'krama') this.checkType(type.of, pos)
    if (type.kind === 'kosa') {
      this.checkType(type.key, pos)
      this.checkType(type.value, pos)
      // kosa keys must be a scalar type
      if (type.key.kind === 'krama' || type.key.kind === 'kosa') {
        this.fail(`kosa key type must be a scalar, not a collection`, pos)
      }
    }
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
