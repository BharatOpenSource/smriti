// AST node types for Smriti. Every parse result is one of these.
// Each node carries its source position for error reporting.

export interface Pos {
  line: number
  col: number
}

// A namespaced reference — namespace comes from the sangama name, member is the local name.
// e.g. `gov.citizen` → { namespace: 'gov', name: 'citizen' }
export interface QualifiedName {
  namespace: string
  name: string
}

export type NameRef = string | QualifiedName

export function nameRefStr(ref: NameRef): string {
  return typeof ref === 'string' ? ref : `${ref.namespace}.${ref.name}`
}

export interface Node {
  pos: Pos
}

// ─── Top level ────────────────────────────────────────────────────────────────

export interface SmritiFile extends Node {
  kind: 'file'
  decls: (SmritiDecl | SutraDecl)[]
}

export interface SmritiDecl extends Node {
  kind: 'smriti'
  name: string
  itiName?: string
  metadata: Metadata
  references: ReferenceDecl[]
  participants: PakshaDecl[]
  trigger?: GhatanaDecl
  aagama?: TypedField[]   // process-level inputs (available throughout the flow)
  nirgama?: TypedField[]  // process-level outputs (declared intent)
  flow?: FlowDecl         // optional — smriti can be declaration-only
}

export interface SutraDecl extends Node {
  kind: 'sutra'
  name: string
  itiName?: string
  metadata: Metadata
  aagama?: TypedField[]
  flow: FlowDecl
  nirgama?: TypedField[]
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface Metadata extends Node {
  kind: 'metadata'
  adhipati?: string
  aavartana?: string
  stara?: 'public' | 'restricted' | 'private'
  prabhaava?: string
  sthala?: string
  kshetra?: string
  avadhi?: number
}

// ─── References ───────────────────────────────────────────────────────────────

export type ReferenceDecl = SangamaDecl | LagnaDecl

export interface SangamaDecl extends Node {
  kind: 'sangama'
  name: string
  yuja: string
}

export interface LagnaDecl extends Node {
  kind: 'lagna'
  name: string
  yuja: string
  adhipati?: string
  aavartana?: string
}

// ─── Participants ─────────────────────────────────────────────────────────────

export interface PakshaDecl extends Node {
  kind: 'paksha'
  name: string
  itiName?: string
  bhumika?: string
  adhikara: string[]
  pramana?: string
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

export interface GhatanaDecl extends Node {
  kind: 'ghatana'
  items: (VrttiDecl | HetuDecl)[]
}

export interface VrttiDecl extends Node {
  kind: 'vrtti'
  description: string
}

export interface HetuDecl extends Node {
  kind: 'hetu'
  description: string
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

export interface FlowDecl extends Node {
  kind: 'pravah'
  items: FlowItem[]
}

export type FlowItem =
  | PadaDecl
  | VibhagaDecl
  | AnubhagaDecl
  | AnugamaDecl
  | AavahaDecl
  | SthitiDecl
  | { kind: 'svasti'; pos: Pos }
  | { kind: 'anaapta'; pos: Pos }

// ─── Step ─────────────────────────────────────────────────────────────────────

export interface PadaDecl extends Node {
  kind: 'pada'
  name: string
  itiName?: string
  karta?: NameRef
  kaarya?: string
  aagama: TypedField[]
  nirgama: TypedField[]
  samaya?: Duration
  khanda?: Expression
  viparyaya?: string              // on failure: route to this step
  routing?: PravrttiDecl | PrativrttiDecl
}

export interface PravrttiDecl extends Node {
  kind: 'pravritti'
  target: string
}

export interface PrativrttiDecl extends Node {
  kind: 'prativritti'
  target: string
}

export interface Duration extends Node {
  kind: 'duration'
  value: number
  unit: 'antara' | 'tithi'
}

// ─── Branching ────────────────────────────────────────────────────────────────

export interface VibhagaDecl extends Node {
  kind: 'vibhaga'
  name?: string
  itiName?: string
  on: string
  clauses: NiyamaClause[]
}

export interface NiyamaClause extends Node {
  kind: 'niyama'
  condition: Expression
  target: string | 'svasti' | 'anaapta'
}

// ─── Parallel ─────────────────────────────────────────────────────────────────

export interface AnubhagaDecl extends Node {
  kind: 'anubhaga'
  tracks: FlowItem[][]
}

export interface AnugamaDecl extends Node {
  kind: 'anugama'
  tracks: string[]
}

// ─── Sub-process ──────────────────────────────────────────────────────────────

export interface AavahaDecl extends Node {
  kind: 'aavaha'
  target: string
  aagama: TypedField[]
  nirgama: TypedField[]
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface SthitiDecl extends Node {
  kind: 'sthiti'
  name: string
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypedField extends Node {
  kind: 'typed-field'
  name: string
  type: SmritiType
  optional: boolean
}

export type SmritiType =
  | { kind: 'sankhya' }
  | { kind: 'bhinnaanka' }
  | { kind: 'dashaamsha' }
  | { kind: 'vakya' }
  | { kind: 'tithi' }
  | { kind: 'antara' }
  | { kind: 'tarka' }
  | { kind: 'patra' }
  | { kind: 'krama'; of: SmritiType }
  | { kind: 'kosa'; key: SmritiType; value: SmritiType }

// ─── Expressions ──────────────────────────────────────────────────────────────

export type Expression =
  | TarkaLiteral
  | IdentifierExpr
  | NumberLiteral
  | StringLiteral
  | CompareExpr
  | LogicalExpr
  | NotExpr

export interface TarkaLiteral extends Node {
  kind: 'tarka-literal'
  value: 'satya' | 'asatya' | 'avyakta'
}

export interface IdentifierExpr extends Node {
  kind: 'identifier'
  name: string
}

export interface NumberLiteral extends Node {
  kind: 'number-literal'
  value: number
}

export interface StringLiteral extends Node {
  kind: 'string-literal'
  value: string
}

export type CompareOp = '==' | '!=' | '<' | '>' | '<=' | '>='

export interface CompareExpr extends Node {
  kind: 'compare'
  left: Expression
  op: CompareOp
  right: Expression
}

export type LogicalOp = '&&' | '||'

export interface LogicalExpr extends Node {
  kind: 'logical'
  left: Expression
  op: LogicalOp
  right: Expression
}

export interface NotExpr extends Node {
  kind: 'not'
  operand: Expression
}

// Render any expression to a human-readable string (for backends/diagnostics).
export function exprStr(expr: Expression): string {
  switch (expr.kind) {
    case 'tarka-literal':  return expr.value
    case 'identifier':     return expr.name
    case 'number-literal': return String(expr.value)
    case 'string-literal': return `"${expr.value}"`
    case 'compare':        return `${exprStr(expr.left)} ${expr.op} ${exprStr(expr.right)}`
    case 'logical':        return `(${exprStr(expr.left)} ${expr.op} ${exprStr(expr.right)})`
    case 'not':            return `!${exprStr(expr.operand)}`
  }
}
