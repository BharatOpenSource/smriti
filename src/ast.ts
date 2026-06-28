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
  decls: (SmritiDecl | SutraDecl | KriyaDecl)[]
}

export interface SmritiDecl extends Node {
  kind: 'smriti'
  name: string
  itiName?: string
  metadata: Metadata
  references: ReferenceDecl[]
  participants: PakshaDecl[]
  kriya: KriyaDecl[]      // scoped private kriya — not importable from outside
  sthitiBlock?: SthitiBlock  // process-scoped mutable state (managed by Layer 4 executor)
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
  parent?: NameRef        // anuvṛtti — inherits from this sutra
  aagama?: TypedField[]   // additional aagama (merged with parent's)
  kriya: KriyaDecl[]      // scoped private kriya for this sutra
  sthitiBlock?: SthitiBlock  // sutra-scoped mutable state
  flow: FlowDecl          // delta: aadesha overrides + new steps + terminals
  nirgama?: TypedField[]  // additional nirgama (merged with parent's)
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
  vrtti?:  Expression     // tarka condition — evaluated against aagama payload
  hetu?:   HetuSchedule   // structured schedule
  karta?:  Expression     // who triggers (informational)
  sthala?: Expression     // where (informational)
  kaarya?: Expression     // what action (informational)
}

export interface HetuSchedule extends Node {
  kind: 'hetu-schedule'
  quantity: number
  unit: string   // user-defined unit — antara, requests, batches, etc.
}

// ─── Flow ─────────────────────────────────────────────────────────────────────

export interface FlowDecl extends Node {
  kind: 'pravah'
  items: FlowItem[]
}

export type FlowItem =
  | PadaDecl
  | AadeshaDecl
  | VarnaDecl
  | VibhagaDecl
  | AnubhagaDecl
  | AnugamaDecl
  | AavahaDecl
  | SthitiDecl
  | { kind: 'svasti'; pos: Pos }
  | { kind: 'anaapta'; pos: Pos }

// ─── aadesha (Pāṇinian substitute — replaces a parent sutra's named step) ─────

export interface AadeshaDecl extends Node {
  kind: 'aadesha'
  target: string   // name of the parent pada being replaced
  pada: PadaDecl   // the replacement step definition
}

// ─── varna (named variable / data binding between steps) ──────────────────────

export interface VarnaDecl extends Node {
  kind: 'varna'
  name: string
  varnaType: SmritiType
  expr?: Expression  // optional computed value from existing flow data
}

// ─── Step ─────────────────────────────────────────────────────────────────────

export interface PadaDecl extends Node {
  kind: 'pada'
  name: string
  itiName?: string
  karta?: NameRef
  kaarya?: string | CallExpr  // string = human description; CallExpr = kriya invocation
  aagama: TypedField[]
  nirgama: TypedField[]
  samaya?: Duration
  khanda?: Expression
  apavaada?: string               // on failure: route to this step
  apavaadaNirgama?: TypedField[]  // fields produced when routing via apavaada
  samapti?: string                // on SLA timeout: route to this step (requires samaya)
  samaptiNirgama?: TypedField[]   // fields produced when routing via samapti
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
  target: NameRef
  aagama: TypedField[]
  nirgama: TypedField[]
}

// ─── State ────────────────────────────────────────────────────────────────────

export interface SthitiDecl extends Node {
  kind: 'sthiti'
  name: string
}

// ─── State (sthiti) ───────────────────────────────────────────────────────────

// sthiti-field: a named, typed, optionally-initialised mutable state cell.
// Used in sthiti-block inside smriti, sutra, or kriya.
export interface SthitiField extends Node {
  kind: 'sthiti-field'
  name: string
  type: SmritiType
  optional: boolean   // declared with `vikalpa` — starts null and may stay null
  init?: Expression   // initial value (null/avyakta if absent)
}

// sthiti-block: the state declaration block.
// Inside kriya: cells are re-initialised on each call (call-local state).
// Inside smriti/sutra: cells are initialised once when the process starts
//   and are managed by the Layer 4 process executor.
export interface SthitiBlock extends Node {
  kind: 'sthiti-block'
  fields: SthitiField[]
}

// ─── Computation (kriya) ──────────────────────────────────────────────────────

export interface KriyaDecl extends Node {
  kind: 'kriya'
  name: string
  itiName?: string
  sparsha?: SparshaDecl   // present = impure; absent = pure (compiler enforces)
  aagama: TypedField[]
  nirgama: TypedField[]
  sthitiBlock?: SthitiBlock  // kriya-local mutable state (re-initialised per call)
  body: KriyaStmt[]
}

// ─── Effects (sparsha) ────────────────────────────────────────────────────────

export interface SparshaDecl extends Node {
  kind: 'sparsha'
  fields: SparshaField[]
}

export type EffectChannel = 'http' | 'file' | 'event'
export type EffectMode = 'read' | 'write' | 'emit' | 'read-write'

export interface SparshaField extends Node {
  kind: 'sparsha-field'
  channel: EffectChannel
  mode: EffectMode
}

// ─── kriya statements ─────────────────────────────────────────────────────────

export type KriyaStmt = AssignStmt | ExprStmt

// assign-stmt: name = expression. name must be a declared nirgama field or local binding.
export interface AssignStmt extends Node {
  kind: 'assign'
  name: string
  expr: Expression
}

// expr-stmt: expression evaluated for side effects only (e.g. calling an impure kriya).
export interface ExprStmt extends Node {
  kind: 'expr-stmt'
  expr: Expression
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypedField extends Node {
  kind: 'typed-field'
  name: string
  type: SmritiType
  optional: boolean
}

export type SmritiType =
  | { kind: 'sankhya'; min?: number; max?: number }
  | { kind: 'bhinnaanka' }
  | { kind: 'dashaamsha' }
  | { kind: 'vakya'; pattern?: string }
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
  | NegateExpr
  | ArithExpr
  | CallExpr

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

export interface NegateExpr extends Node {
  kind: 'negate'
  operand: Expression
}

export type ArithOp = '+' | '-' | '*' | '/' | '%'

export interface ArithExpr extends Node {
  kind: 'arith'
  left: Expression
  op: ArithOp
  right: Expression
}

export interface CallExpr extends Node {
  kind: 'call'
  callee: NameRef
  args: Expression[]
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
    case 'negate':         return `-${exprStr(expr.operand)}`
    case 'arith':          return `(${exprStr(expr.left)} ${expr.op} ${exprStr(expr.right)})`
    case 'call':           return `${nameRefStr(expr.callee)}(${expr.args.map(exprStr).join(', ')})`
  }
}
