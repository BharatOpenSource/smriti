// Emits a SmritiDecl as pravaaha-compatible YAML.
// Mapping: smriti → process, paksha → party, pada → step, vibhaga → conditions.

import type {
  SmritiDecl, PakshaDecl, FlowItem, PadaDecl,
  VibhagaDecl, TypedField,
} from '../ast.js'
import { nameRefStr, exprStr } from '../ast.js'

// ─── Public API ───────────────────────────────────────────────────────────────

export function toYaml(decl: SmritiDecl): string {
  return serialize({ process: buildProcess(decl) })
}

// ─── Process ──────────────────────────────────────────────────────────────────

function buildProcess(decl: SmritiDecl): object {
  const meta = decl.metadata

  const process: Record<string, unknown> = {
    id: decl.name,
    name: prettify(decl.name),
    version: meta.aavartana ?? '0.1.0',
  }

  if (meta.adhipati) {
    process.owner = {
      id: slug(meta.adhipati),
      name: meta.adhipati,
      vpa_tier: 'unverified',
    }
  }

  if (meta.stara)          process.visibility       = meta.stara
  if (meta.avadhi != null) process.change_lock_days = meta.avadhi
  if (meta.sthala)         process.jurisdiction     = meta.sthala
  if (meta.kshetra)        process.region           = meta.kshetra
  if (meta.prabhaava)      process.effective_date   = meta.prabhaava

  if (decl.participants.length > 0)
    process.parties = decl.participants.map(buildParty)

  const rights = buildRights(decl.participants)
  if (rights.length > 0) process.rights = rights

  if (decl.flow) {
    // Index vibhaga by what they branch on so steps can embed their conditions.
    const vibhagaByOn = new Map<string, VibhagaDecl>()
    for (const item of decl.flow.items) {
      if (item.kind === 'vibhaga') vibhagaByOn.set(item.on, item)
    }
    process.steps = buildSteps(decl.flow.items, vibhagaByOn)
  }

  return process
}

// ─── Parties ──────────────────────────────────────────────────────────────────

function buildParty(p: PakshaDecl): object {
  const party: Record<string, unknown> = { id: p.name }
  if (p.bhumika) party.role = prettify(p.bhumika)
  return party
}

function buildRights(participants: PakshaDecl[]): object[] {
  const rights: object[] = []
  for (const p of participants) {
    for (const right of p.adhikara) {
      const entry: Record<string, unknown> = {
        party: p.name,
        right: prettify(right),
      }
      if (p.pramana) {
        entry.authority = { citation: p.pramana }
      }
      rights.push(entry)
    }
  }
  return rights
}

// ─── Steps ────────────────────────────────────────────────────────────────────

function buildSteps(
  items: FlowItem[],
  vibhagaByOn: Map<string, VibhagaDecl>,
): object[] {
  const steps: object[] = []
  const consumed = new Set<VibhagaDecl>()

  for (const item of items) {
    if (item.kind === 'pada') {
      steps.push(buildStep(item, vibhagaByOn, consumed))
    } else if (item.kind === 'svasti') {
      steps.push({ id: 'svasti', name: 'Completed', terminal: true, outcome: 'success' })
    } else if (item.kind === 'anaapta') {
      steps.push({ id: 'anaapta', name: 'Rejected', terminal: true, outcome: 'failure' })
    } else if (item.kind === 'sthiti') {
      steps.push({ id: item.name, name: prettify(item.name), status: item.name })
    }
    // vibhaga, anubhaga, anugama, aavaha: handled elsewhere or future work
  }

  return steps
}

function buildStep(
  pada: PadaDecl,
  vibhagaByOn: Map<string, VibhagaDecl>,
  consumed: Set<VibhagaDecl>,
): object {
  const step: Record<string, unknown> = {
    id: pada.name,
    name: prettify(pada.name),
  }

  if (pada.karta)  step.actor  = nameRefStr(pada.karta)
  if (pada.kaarya) step.action = pada.kaarya

  if (pada.aagama.length > 0) step.inputs  = fields(pada.aagama)
  if (pada.nirgama.length > 0) step.outputs = fields(pada.nirgama)

  if (pada.samaya) {
    step.sla = `${pada.samaya.value} ${pada.samaya.unit}`
  }

  if (pada.khanda) {
    step.precondition = exprStr(pada.khanda)
  }

  // Check if any output field has a vibhaga routing on it
  const routingVibhaga = pada.nirgama
    .map(f => vibhagaByOn.get(f.name))
    .find(v => v !== undefined)

  if (routingVibhaga && !consumed.has(routingVibhaga)) {
    consumed.add(routingVibhaga)
    step.conditions = routingVibhaga.clauses.map(c => ({
      if: exprStr(c.condition),
      next: c.target,
    }))
  } else if (pada.routing?.kind === 'pravritti') {
    step.next = pada.routing.target
  } else if (pada.routing?.kind === 'prativritti') {
    step.loop_back = pada.routing.target
  }

  return step
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fields(typed: TypedField[]): string[] {
  return typed.map(f => f.name)
}


// "passport-renewal" → "Passport Renewal"
function prettify(s: string): string {
  return s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// "Ministry of External Affairs" → "ministry-of-external-affairs"
function slug(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

// ─── YAML serializer ──────────────────────────────────────────────────────────
// Minimal hand-built serializer — no external dependencies.
// Handles: objects, arrays, strings, numbers, booleans, null.

function serialize(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)

  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number')  return String(value)

  if (typeof value === 'string') {
    const needsQuote =
      value === '' ||
      /[:#\[\]{}&*!|>'"%@`]/.test(value) ||
      /^\s|\s$/.test(value) ||
      value === 'true' || value === 'false' || value === 'null' ||
      /^\d[\d.]*$/.test(value)  // pure numbers or version-like (e.g. 1.0.0)
    return needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    // Flat scalar arrays → inline
    const allScalar = value.every(v => typeof v !== 'object' || v === null)
    if (allScalar) {
      return '[' + value.map(v => serialize(v)).join(', ') + ']'
    }
    return '\n' + value
      .map(v => `${pad}- ${serialize(v, indent + 1).trimStart()}`)
      .join('\n')
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null &&
        !(Array.isArray(v) && v.length === 0))
    if (entries.length === 0) return '{}'

    return entries
      .map(([k, v]) => {
        const vStr = serialize(v, indent + 1)
        // Inline: scalars and flat scalar arrays
        const isInline =
          typeof v !== 'object' || v === null ||
          (Array.isArray(v) && (v as unknown[]).every(i => typeof i !== 'object' || i === null))
        return isInline
          ? `${pad}${k}: ${vStr}`
          : `${pad}${k}:${vStr.startsWith('\n') ? vStr : '\n' + vStr}`
      })
      .join('\n')
  }

  return String(value)
}
