// SVG flow diagram emitter for SmritiDecl.
// Layout: linear top-to-bottom. Steps as boxes, vibhaga as decision boxes,
// terminals as coloured endpoints. No complex graph layout — readable at v0.1.

import type { SmritiDecl, FlowItem, PadaDecl, VibhagaDecl } from '../ast.js'

// ─── Layout constants ────────────────────────────────────────────────────────

const W       = 840          // canvas width
const CX      = W / 2        // center x
const BOX_W   = 680          // standard box width
const BOX_X   = (W - BOX_W) / 2
const STEP_H  = 100          // height of a step box
const VIB_H   = 80           // height of a vibhaga box
const TERM_H  = 60           // height of a terminal box
const HDR_H   = 90           // header box height
const ARROW   = 36           // vertical gap for arrows
const GAP     = 8            // gap between items

// ─── Colours ─────────────────────────────────────────────────────────────────

const C = {
  hdrFill:  '#1A1A2E', hdrText: '#FFFFFF',
  stepFill: '#F8FAFF', stepBorder: '#4A90D9', stepText: '#1A1A2E',
  vibFill:  '#FFFBF0', vibBorder: '#E67E22', vibText: '#7D4800',
  ok:       '#27AE60', okText: '#FFFFFF',
  fail:     '#E74C3C', failText: '#FFFFFF',
  arrow:    '#7F8C8D', meta: '#6C757D',
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function toSvg(decl: SmritiDecl): string {
  const items = decl.flow?.items ?? []

  // Calculate total canvas height
  let totalH = 20 + HDR_H + ARROW
  for (const item of items) totalH += itemH(item) + ARROW + GAP
  if (items.length === 0) totalH += 60  // room for "declaration only" note
  totalH += 40

  const parts: string[] = [header(totalH)]
  let y = 20

  parts.push(headerBox(decl, y))
  y += HDR_H

  if (items.length === 0) {
    // Declaration-only smriti — show participants if present, note no flow
    const note = decl.participants.length > 0
      ? `${decl.participants.length} participant${decl.participants.length > 1 ? 's' : ''} declared · no pravah`
      : 'declaration only · no pravah'
    parts.push(text(CX, y + ARROW + 20, note, C.meta, 13))
  }

  for (const item of items) {
    parts.push(arrowLine(CX, y, y + ARROW))
    y += ARROW
    parts.push(renderItem(item, y))
    y += itemH(item) + GAP
  }

  parts.push('</svg>')
  return parts.join('\n')
}

// ─── Height calculation ───────────────────────────────────────────────────────

function itemH(item: FlowItem): number {
  if (item.kind === 'pada')    return stepBoxH(item)
  if (item.kind === 'vibhaga') return vibBoxH(item)
  if (item.kind === 'svasti' || item.kind === 'anaapta') return TERM_H
  if (item.kind === 'sthiti')  return TERM_H
  return 0
}

function stepBoxH(pada: PadaDecl): number {
  let lines = 1                             // name
  if (pada.karta)               lines += 1
  if (pada.kaarya)              lines += wrapLines(pada.kaarya, 72)
  if (pada.aagama.length > 0)   lines += 1
  if (pada.nirgama.length > 0)  lines += 1
  if (pada.samaya)              lines += 1
  return Math.max(STEP_H, lines * 20 + 24)
}

function vibBoxH(v: VibhagaDecl): number {
  return Math.max(VIB_H, v.clauses.length * 22 + 40)
}

// ─── SVG header ──────────────────────────────────────────────────────────────

function header(height: number): string {
  return [
    `<svg width="${W}" height="${height}" xmlns="http://www.w3.org/2000/svg"`,
    `     font-family="'Segoe UI', system-ui, sans-serif" font-size="14">`,
    `  <defs>`,
    `    <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">`,
    `      <path d="M0,0 L0,6 L8,3 z" fill="${C.arrow}"/>`,
    `    </marker>`,
    `  </defs>`,
    `  <rect width="${W}" height="${height}" fill="#F4F6F9"/>`,
  ].join('\n')
}

// ─── Process header box ──────────────────────────────────────────────────────

function headerBox(decl: SmritiDecl, y: number): string {
  const meta = decl.metadata
  const subtitle = [
    meta.adhipati,
    meta.aavartana ? `v${meta.aavartana}` : null,
    meta.stara,
    meta.sthala,
  ].filter(Boolean).join('  ·  ')

  return [
    rect(BOX_X, y, BOX_W, HDR_H, 10, C.hdrFill, C.hdrFill),
    text(CX, y + 34, decl.name, C.hdrText, 20, 'bold'),
    text(CX, y + 58, subtitle, '#A0AEC0', 12),
    decl.trigger
      ? text(CX, y + 78, `⚡ ${decl.trigger.items[0]?.description ?? 'triggered'}`, '#7EC8E3', 11)
      : '',
  ].join('\n')
}

// ─── Flow items ──────────────────────────────────────────────────────────────

function renderItem(item: FlowItem, y: number): string {
  switch (item.kind) {
    case 'pada':    return renderStep(item, y)
    case 'vibhaga': return renderVibhaga(item, y)
    case 'svasti':  return terminalBox(y, '✓  Completed', C.ok, C.okText)
    case 'anaapta': return terminalBox(y, '✗  Rejected', C.fail, C.failText)
    case 'sthiti':  return terminalBox(y, `◎  ${item.name}`, '#8E44AD', '#FFFFFF')
    default:        return ''
  }
}

function renderStep(pada: PadaDecl, y: number): string {
  const h = stepBoxH(pada)
  const parts: string[] = [
    rect(BOX_X, y, BOX_W, h, 8, C.stepFill, C.stepBorder, 2),
  ]

  // Step name badge
  parts.push(pill(BOX_X + 16, y + 14, pada.name, C.stepBorder, '#FFFFFF'))

  let ty = y + 44
  if (pada.karta) {
    parts.push(metaLine(BOX_X + 16, ty, `Actor:`, pada.karta))
    ty += 20
  }
  if (pada.kaarya) {
    const lines = wrapText(pada.kaarya, 72)
    for (const line of lines) {
      parts.push(text(BOX_X + 16, ty, line, C.stepText, 13, 'normal', 'start'))
      ty += 18
    }
  }
  if (pada.aagama.length > 0) {
    parts.push(metaLine(BOX_X + 16, ty, 'In:', pada.aagama.map(f => fieldLabel(f)).join(', ')))
    ty += 20
  }
  if (pada.nirgama.length > 0) {
    parts.push(metaLine(BOX_X + 16, ty, 'Out:', pada.nirgama.map(f => fieldLabel(f)).join(', ')))
    ty += 20
  }
  if (pada.samaya) {
    parts.push(metaLine(BOX_X + 16, ty, 'SLA:', `${pada.samaya.value} ${pada.samaya.unit}`))
  }

  return parts.join('\n')
}

function renderVibhaga(v: VibhagaDecl, y: number): string {
  const h = vibBoxH(v)
  const parts: string[] = [
    rect(BOX_X, y, BOX_W, h, 8, C.vibFill, C.vibBorder, 2, '6,3'),
    pill(BOX_X + 16, y + 14, `◇  branch: ${v.on}`, C.vibBorder, '#FFFFFF'),
  ]

  let ty = y + 44
  for (const clause of v.clauses) {
    const cond = exprLabel(clause.condition)
    const target = clause.target
    const arrow = target === 'svasti' ? '→ ✓' : target === 'anaapta' ? '→ ✗' : `→ ${target}`
    parts.push(
      text(BOX_X + 28, ty, cond, C.vibText, 13, 'bold', 'start'),
      text(BOX_X + 120, ty, arrow, C.stepText, 13, 'normal', 'start'),
    )
    ty += 22
  }

  return parts.join('\n')
}

function terminalBox(y: number, label: string, fill: string, textColor: string): string {
  return [
    rect(BOX_X + 120, y, BOX_W - 240, TERM_H, TERM_H / 2, fill, fill),
    text(CX, y + TERM_H / 2 + 5, label, textColor, 15, 'bold'),
  ].join('\n')
}

// ─── SVG primitives ──────────────────────────────────────────────────────────

function rect(
  x: number, y: number, w: number, h: number, rx: number,
  fill: string, stroke: string, strokeW = 1, dash = '',
): string {
  const d = dash ? ` stroke-dasharray="${dash}"` : ''
  return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}"` +
    ` fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"${d}/>`
}

function text(
  x: number, y: number, content: string,
  fill: string, size = 14,
  weight: 'normal' | 'bold' = 'normal',
  anchor: 'middle' | 'start' = 'middle',
): string {
  const esc = content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `  <text x="${x}" y="${y}" fill="${fill}" font-size="${size}"` +
    ` font-weight="${weight}" text-anchor="${anchor}">${esc}</text>`
}

function pill(x: number, cy: number, label: string, fill: string, textCol: string): string {
  const w = Math.min(label.length * 7.5 + 20, BOX_W - 32)
  return [
    `  <rect x="${x}" y="${cy - 12}" width="${w}" height="22" rx="11" fill="${fill}"/>`,
    `  <text x="${x + 10}" y="${cy + 4}" fill="${textCol}" font-size="12" font-weight="bold">${
      label.replace(/&/g, '&amp;')
    }</text>`,
  ].join('\n')
}

function arrowLine(x: number, y1: number, y2: number): string {
  return `  <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 6}"` +
    ` stroke="${C.arrow}" stroke-width="2" marker-end="url(#arr)"/>`
}

function metaLine(x: number, y: number, label: string, value: string): string {
  return [
    text(x, y, label, C.meta, 12, 'bold', 'start'),
    text(x + 44, y, value, C.stepText, 12, 'normal', 'start'),
  ].join('\n')
}

// ─── Text utilities ───────────────────────────────────────────────────────────

function fieldLabel(f: { name: string; type: { kind: string }; optional: boolean }): string {
  return `${f.optional ? '?' : ''}${f.name} (${f.type.kind})`
}

function exprLabel(expr: { kind: string; name?: string; value?: string }): string {
  if (expr.kind === 'tarka-literal') return expr.value ?? ''
  if (expr.kind === 'identifier')    return expr.name ?? ''
  return ''
}

function wrapLines(s: string, limit: number): number {
  return Math.ceil(s.length / limit)
}

function wrapText(s: string, limit: number): string[] {
  if (s.length <= limit) return [s]
  const words = s.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length > limit) {
      if (current) lines.push(current.trim())
      current = w
    } else {
      current = (current + ' ' + w).trim()
    }
  }
  if (current) lines.push(current.trim())
  return lines
}
