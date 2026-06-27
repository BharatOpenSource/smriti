import type {
  SmritiFile, SmritiDecl, SutraDecl,
  FlowDecl, FlowItem, PadaDecl, VibhagaDecl,
  TypedField, SmritiType, Pos,
} from './ast.js'
import { nameRefStr } from './ast.js'
import type { ResolveContext } from './resolver.js'

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
    if (decl.flow) this.checkFlow(decl.flow, participantNames)
  }

  private checkSutra(decl: SutraDecl) {
    this.checkIti(decl.name, decl.itiName, decl.pos)
    this.checkFlow(decl.flow, new Set())
    if (decl.aagama) this.checkTypedFields(decl.aagama)
    if (decl.nirgama) this.checkTypedFields(decl.nirgama)
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

  private checkFlow(flow: FlowDecl, participants: Set<string>) {
    const stepNames = this.collectStepNames(flow)
    this.checkStepUniqueness(flow)

    for (const item of flow.items) {
      this.checkFlowItem(item, stepNames, participants)
    }

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
  }

  private collectStepNames(flow: FlowDecl): Set<string> {
    const names = new Set<string>()
    for (const item of flow.items) {
      if (item.kind === 'pada') names.add(item.name)
      if (item.kind === 'sthiti') names.add(item.name)
    }
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
      case 'vibhaga':  return this.checkVibhaga(item, stepNames)
      case 'anubhaga': {
        for (const track of item.tracks) {
          const inner = { kind: 'pravah' as const, items: track, pos: item.pos }
          this.checkFlow(inner, participants)
        }
        return
      }
      case 'svasti':
      case 'anaapta':
      case 'sthiti':
      case 'anugama':
      case 'aavaha':
        return
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

    if (pada.aagama) this.checkTypedFields(pada.aagama)
    if (pada.nirgama) this.checkTypedFields(pada.nirgama)
  }

  // ─── Branching ─────────────────────────────────────────────────────────────

  private checkVibhaga(vibhaga: VibhagaDecl, stepNames: Set<string>) {
    if (vibhaga.itiName) this.checkIti(vibhaga.on, vibhaga.itiName, vibhaga.pos)
    // All branch targets must exist
    for (const clause of vibhaga.clauses) {
      const target = clause.target
      if (target !== 'svasti' && target !== 'anaapta' && !stepNames.has(target)) {
        this.fail(
          `niyama target '${target}' does not exist in this pravah`,
          clause.pos,
        )
      }
    }

    // If branching on a tarka value, warn about missing cases
    const tarkaClauses = vibhaga.clauses.filter(
      c => c.condition.kind === 'tarka-literal'
    )
    if (tarkaClauses.length > 0) {
      const covered = new Set(
        tarkaClauses
          .filter(c => c.condition.kind === 'tarka-literal')
          .map(c => (c.condition as { value: string }).value)
      )
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
