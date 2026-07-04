import type { FlowItem, FlowDecl, PadaDecl, SmritiDecl } from './ast.js'
import { nameRefStr } from './ast.js'
import { evaluate, evaluateKriya, buildInitialState, type KriyaEnv, type Payload } from './evaluator.js'
import type { Registry, SangrahaEnv } from './registry.js'

// ─── Result types ─────────────────────────────────────────────────────────────

export interface StepLog {
  name: string
  status: 'completed' | 'skipped' | 'auto-completed'
  produced: Payload
}

export interface FlowResult {
  outcome: 'svasti' | 'anaapta'
  produced: Payload
  log: StepLog[]
  steps: number
}

// ─── Entry points ─────────────────────────────────────────────────────────────

export function executeSmriti(
  decl: SmritiDecl,
  initial: Payload,
  env: KriyaEnv,
  registry?: Registry,
  budget?: number[],
  stores?: SangrahaEnv,
): FlowResult {
  if (!decl.flow) throw new Error(`smriti '${decl.name}' has no pravah`)
  const seed: Payload = decl.sthitiBlock ? buildInitialState(decl.sthitiBlock, env) : {}
  const produced: Payload = { ...seed, ...initial }
  const b = budget ?? [10_000]
  return runFlow(decl.flow.items, produced, env, b, registry, stores)
}

export function executeFlow(
  flow: FlowDecl,
  initial: Payload,
  env: KriyaEnv,
  maxSteps = 10_000,
  registry?: Registry,
  stores?: SangrahaEnv,
): FlowResult {
  const budget = [maxSteps]
  return runFlow(flow.items, { ...initial }, env, budget, registry, stores)
}

// ─── Core executor ────────────────────────────────────────────────────────────

function runFlow(
  items: FlowItem[],
  produced: Payload,
  env: KriyaEnv,
  budget: number[],
  registry?: Registry,
  stores?: SangrahaEnv,
): FlowResult {
  const log: StepLog[] = []
  const stepIndex = buildStepIndex(items)
  let cursor = 0

  while (cursor < items.length) {
    if (budget[0]-- <= 0) {
      throw new Error('smriti executor: step limit exceeded — possible infinite loop')
    }

    const item = items[cursor]

    switch (item.kind) {
      case 'svasti':
        return { outcome: 'svasti', produced, log, steps: 10_000 - budget[0] }

      case 'anaapta':
        return { outcome: 'anaapta', produced, log, steps: 10_000 - budget[0] }

      case 'pada': {
        const { skipped, outputs, jump } = executePada(item, produced, env, stepIndex)
        if (skipped) {
          log.push({ name: item.name, status: 'skipped', produced: {} })
        } else {
          Object.assign(produced, outputs)
          log.push({ name: item.name, status: outputs.__autoCompleted ? 'auto-completed' : 'completed', produced: filterAuto(outputs) })
        }
        cursor = jump !== undefined ? jump : cursor + 1
        break
      }

      case 'aadesha': {
        const { skipped, outputs, jump } = executePada(item.pada, produced, env, stepIndex)
        if (skipped) {
          log.push({ name: item.pada.name, status: 'skipped', produced: {} })
        } else {
          Object.assign(produced, outputs)
          log.push({ name: item.pada.name, status: outputs.__autoCompleted ? 'auto-completed' : 'completed', produced: filterAuto(outputs) })
        }
        cursor = jump !== undefined ? jump : cursor + 1
        break
      }

      case 'varna': {
        const value = item.expr ? evaluate(item.expr, produced, env) : null
        produced[item.name] = value
        cursor++
        break
      }

      case 'vibhaga': {
        let target: string | 'svasti' | 'anaapta' | null = null
        for (const clause of item.clauses) {
          const result = evaluate(clause.condition, produced, env)
          if (result === true) { target = clause.target; break }
        }
        if (target === 'svasti') return { outcome: 'svasti', produced, log, steps: 10_000 - budget[0] }
        if (target === 'anaapta') return { outcome: 'anaapta', produced, log, steps: 10_000 - budget[0] }
        if (target) {
          const idx = stepIndex.get(target)
          cursor = idx !== undefined ? idx : cursor + 1
        } else {
          cursor++
        }
        break
      }

      case 'anubhaga': {
        for (const track of item.tracks) {
          const trackResult = runFlow(track, { ...produced }, env, budget, registry, stores)
          Object.assign(produced, trackResult.produced)
          log.push(...trackResult.log)
          if (trackResult.outcome === 'anaapta') {
            return { outcome: 'anaapta', produced, log, steps: 10_000 - budget[0] }
          }
        }
        cursor++
        break
      }

      case 'anugama':
        cursor++
        break

      case 'aavaha': {
        const t = item.target
        if (typeof t !== 'string' && stores?.has(t.namespace)) {
          const store = stores.get(t.namespace)!
          const opName = t.name as 'likha' | 'pathana' | 'uddhaara' | 'lopa'
          const kriyaName = store[opName]
          const kriya = kriyaName ? env.get(kriyaName) : undefined
          if (!kriya) {
            log.push({ name: `${t.namespace}.${t.name}`, status: 'skipped', produced: {} })
          } else {
            const args = item.aagama.map(f => produced[f.name] ?? null)
            const result = evaluateKriya(kriya, args, env)
            const outputs: Payload = {}
            for (let i = 0; i < item.nirgama.length && i < kriya.nirgama.length; i++) {
              outputs[item.nirgama[i].name] = result[kriya.nirgama[i].name] ?? null
            }
            Object.assign(produced, outputs)
            log.push({ name: `${t.namespace}.${t.name}`, status: 'completed', produced: outputs })
          }
          cursor++
          break
        }

        const targetName = nameRefStr(item.target)
        const sub = registry?.get(targetName)
        if (!sub) {
          log.push({ name: targetName, status: 'skipped', produced: {} })
        } else {
          // Build sub-process aagama from current produced (matched by name)
          const subPayload: Payload = {}
          for (const f of item.aagama) subPayload[f.name] = produced[f.name] ?? null
          const subResult = executeSmriti(sub as SmritiDecl, subPayload, env, registry, budget)
          // Bind declared nirgama from sub-process back into parent produced
          const subOut: Payload = {}
          for (const f of item.nirgama) {
            subOut[f.name] = subResult.produced[f.name] ?? null
            produced[f.name] = subOut[f.name]
          }
          log.push({ name: targetName, status: subResult.outcome === 'svasti' ? 'completed' : 'skipped', produced: subOut })
          // Sub-process anaapta propagates to parent
          if (subResult.outcome === 'anaapta') {
            log.push(...subResult.log)
            return { outcome: 'anaapta', produced, log, steps: 10_000 - budget[0] }
          }
          log.push(...subResult.log)
        }
        cursor++
        break
      }

      case 'sthiti':
        cursor++
        break

      default:
        cursor++
    }
  }

  return { outcome: 'svasti', produced, log, steps: 10_000 - budget[0] }
}

// ─── Pada execution ───────────────────────────────────────────────────────────

function executePada(
  pada: PadaDecl,
  ctx: Payload,
  env: KriyaEnv,
  stepIndex: Map<string, number>,
): { skipped: boolean; outputs: Payload; jump?: number } {
  if (pada.khanda) {
    const guard = evaluate(pada.khanda, ctx, env)
    if (guard === false || guard === null) return { skipped: true, outputs: {} }
  }

  const outputs: Payload = {}

  // kaarya: kriya invocation — positional mapping: pada.nirgama[i] ← kriya.nirgama[i]
  if (pada.kaarya && typeof pada.kaarya === 'object' && pada.kaarya.kind === 'call') {
    const callee = nameRefStr(pada.kaarya.callee)
    const kriya = env.get(callee)
    if (kriya) {
      const args = pada.kaarya.args.map(a => evaluate(a, ctx, env))
      const result = evaluateKriya(kriya, args, env)
      for (let i = 0; i < pada.nirgama.length && i < kriya.nirgama.length; i++) {
        outputs[pada.nirgama[i].name] = result[kriya.nirgama[i].name] ?? null
      }
    }
  }

  // Auto-complete nirgama fields not produced by the kriya (human step or missing kriya)
  let autoCompleted = false
  for (const f of pada.nirgama) {
    if (!(f.name in outputs)) { outputs[f.name] = null; autoCompleted = true }
  }
  if (autoCompleted) outputs.__autoCompleted = true

  let jump: number | undefined
  if (pada.routing) {
    const idx = stepIndex.get(pada.routing.target)
    if (idx !== undefined) jump = idx
  }

  return { skipped: false, outputs, jump }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildStepIndex(items: FlowItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.kind === 'pada') map.set(item.name, i)
    else if (item.kind === 'aadesha') map.set(item.pada.name, i)
    else if (item.kind === 'varna') map.set(item.name, i)
    else if (item.kind === 'vibhaga' && item.name) map.set(item.name, i)
    else if (item.kind === 'sthiti') map.set(item.name, i)
  }
  return map
}

function filterAuto(outputs: Payload): Payload {
  const { __autoCompleted: _, ...rest } = outputs
  return rest
}
