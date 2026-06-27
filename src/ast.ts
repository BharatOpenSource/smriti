// AST node types for Smriti. Every parse result is one of these.
// Each node carries its source position for error reporting.

export interface Pos {
  line: number
  col: number
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
  metadata: Metadata
  references: ReferenceDecl[]
  participants: PakshaDecl[]
  trigger?: GhatanaDecl
  flow: FlowDecl
}

export interface SutraDecl extends Node {
  kind: 'sutra'
  name: string
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
  karta?: string
  kaarya?: string
  aagama: TypedField[]
  nirgama: TypedField[]
  samaya?: Duration
  khanda?: Expression
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
  | ComparisonExpr

export interface TarkaLiteral extends Node {
  kind: 'tarka-literal'
  value: 'satya' | 'asatya' | 'avyakta'
}

export interface IdentifierExpr extends Node {
  kind: 'identifier'
  name: string
}

export interface ComparisonExpr extends Node {
  kind: 'comparison'
  left: string
  op: '=' | '≠' | '>' | '<' | '≥' | '≤'
  right: string | number
}
