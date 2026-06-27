// Emits a SutraDecl as a YAML interface document.
// Format: sutra id, aagama, nirgama, and a linear step list.
// Intended use: publish the interface of a .sut file for consumers.

import type { SutraDecl, TypedField, SmritiType, FlowItem } from '../ast.js'
import { nameRefStr } from '../ast.js'

export function toSutraYaml(decl: SutraDecl): string {
  const out: Record<string, unknown> = {
    id: decl.name,
    kind: 'sutra',
    version: decl.metadata?.aavartana ?? '0.1.0',
  }

  if (decl.metadata?.adhipati) out.owner = decl.metadata.adhipati
  if (decl.parent) out.parent = nameRefStr(decl.parent)
  if (decl.aagama && decl.aagama.length > 0)  out.aagama  = decl.aagama.map(fieldSummary)
  if (decl.nirgama && decl.nirgama.length > 0) out.nirgama = decl.nirgama.map(fieldSummary)

  const steps = collectSteps(decl.flow.items)
  if (steps.length > 0) out.steps = steps

  return serialize({ sutra: out })
}

function fieldSummary(f: TypedField): Record<string, unknown> {
  const entry: Record<string, unknown> = { name: f.name, type: typeStr(f.type) }
  if (f.optional) entry.optional = true
  return entry
}

function typeStr(t: SmritiType): string {
  if (t.kind === 'krama') return `krama[${typeStr(t.of)}]`
  if (t.kind === 'kosa')  return `kosa[${typeStr(t.key)}, ${typeStr(t.value)}]`
  if (t.kind === 'sankhya') {
    if (t.min !== undefined || t.max !== undefined) return `sankhya ${t.min ?? ''}..${t.max ?? ''}`
  }
  if (t.kind === 'vakya' && t.pattern) return `vakya "${t.pattern}"`
  return t.kind
}

function collectSteps(items: FlowItem[]): object[] {
  const steps: object[] = []
  for (const item of items) {
    if (item.kind === 'pada') {
      const step: Record<string, unknown> = { id: item.name }
      if (item.kaarya) step.action = item.kaarya
      if (item.aagama.length > 0)  step.aagama  = item.aagama.map(f => f.name)
      if (item.nirgama.length > 0) step.nirgama = item.nirgama.map(f => f.name)
      if (item.samaya) step.sla = `${item.samaya.value} ${item.samaya.unit}`
      steps.push(step)
    } else if (item.kind === 'aadesha') {
      const step: Record<string, unknown> = { id: item.target, override: true }
      if (item.pada.kaarya) step.action = item.pada.kaarya
      steps.push(step)
    } else if (item.kind === 'sthiti') {
      steps.push({ id: item.name, kind: 'sthiti' })
    } else if (item.kind === 'svasti') {
      steps.push({ id: 'svasti', terminal: true, outcome: 'success' })
    } else if (item.kind === 'anaapta') {
      steps.push({ id: 'anaapta', terminal: true, outcome: 'failure' })
    }
  }
  return steps
}

// ─── Minimal YAML serializer (same approach as yaml.ts) ───────────────────────

function serialize(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent)
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number')  return String(value)
  if (typeof value === 'string') {
    const needsQuote =
      value === '' || /[:#\[\]{}&*!|>'"%@`]/.test(value) ||
      /^\s|\s$/.test(value) || value === 'true' || value === 'false' || value === 'null' ||
      /^\d[\d.]*$/.test(value)
    return needsQuote ? `"${value.replace(/"/g, '\\"')}"` : value
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const allScalar = value.every(v => typeof v !== 'object' || v === null)
    if (allScalar) return '[' + value.map(v => serialize(v)).join(', ') + ']'
    return '\n' + value.map(v => `${pad}- ${serialize(v, indent + 1).trimStart()}`).join('\n')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0))
    if (entries.length === 0) return '{}'
    return entries.map(([k, v]) => {
      const vStr = serialize(v, indent + 1)
      const isInline = typeof v !== 'object' || v === null ||
        (Array.isArray(v) && (v as unknown[]).every(i => typeof i !== 'object' || i === null))
      return isInline ? `${pad}${k}: ${vStr}` : `${pad}${k}:${vStr.startsWith('\n') ? vStr : '\n' + vStr}`
    }).join('\n')
  }
  return String(value)
}
