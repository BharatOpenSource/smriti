import { lex, TokenKind, type Token } from './lexer.js'
import type {
  SmritiFile, SmritiDecl, SutraDecl,
  Metadata, ReferenceDecl, SangamaDecl, LagnaDecl,
  PakshaDecl, GhatanaDecl, HetuSchedule, AadeshaDecl,
  FlowDecl, FlowItem, PadaDecl, Duration,
  VarnaDecl,
  VibhagaDecl, NiyamaClause, AnubhagaDecl, AnugamaDecl,
  AavahaDecl, SthitiDecl, TypedField, SmritiType,
  Expression, TarkaLiteral, IdentifierExpr,
  NumberLiteral, StringLiteral, CompareExpr, LogicalExpr, NotExpr,
  NegateExpr, ArithExpr, ArithOp, CallExpr,
  CompareOp, LogicalOp,
  PravrttiDecl, PrativrttiDecl, Pos,
  NameRef,
  KriyaDecl, SparshaDecl, SparshaField, EffectChannel, EffectMode,
  KriyaStmt, AssignStmt, ExprStmt,
  SthitiBlock, SthitiField,
} from './ast.js'

export class ParseError extends Error {
  constructor(message: string, public pos: Pos) {
    super(`[${pos.line}:${pos.col}] ${message}`)
  }
}

class Parser {
  private tokens: Token[]
  private i = 0

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  private peek(): Token { return this.tokens[this.i] }
  private pos(): Pos { return this.peek().pos }

  private advance(): Token { return this.tokens[this.i++] }

  private check(kind: TokenKind): boolean { return this.peek().kind === kind }

  private eat(kind: TokenKind, context?: string): Token {
    if (!this.check(kind)) {
      const got = this.peek()
      const ctx = context ? ` in ${context}` : ''
      throw new ParseError(
        `Expected '${kind}'${ctx}, got '${got.value || got.kind}'`,
        got.pos,
      )
    }
    return this.advance()
  }

  private tryEat(kind: TokenKind): Token | null {
    if (this.check(kind)) return this.advance()
    return null
  }

  // Parses `identifier` or `namespace.member` — used wherever an entity reference can be qualified.
  private parseNameRef(): NameRef {
    const first = this.eat(TokenKind.IDENTIFIER).value
    if (this.tryEat(TokenKind.DOT)) {
      const member = this.eat(TokenKind.IDENTIFIER, 'qualified name').value
      return { namespace: first, name: member }
    }
    return first
  }

  // Parses optional `iti <name>` after a closing brace. Returns the name or undefined.
  private tryEatIti(): string | undefined {
    if (!this.check(TokenKind.ITI)) return undefined
    this.advance()
    return this.eat(TokenKind.IDENTIFIER, 'iti').value
  }

  // ─── Top level ──────────────────────────────────────────────────────────────

  parseFile(): SmritiFile {
    const pos = this.pos()
    const decls: (SmritiDecl | SutraDecl | KriyaDecl)[] = []
    while (!this.check(TokenKind.EOF)) {
      if (this.check(TokenKind.SMRITI))      decls.push(this.parseSmriti())
      else if (this.check(TokenKind.SUTRA))  decls.push(this.parseSutra())
      else if (this.check(TokenKind.KRIYA))  decls.push(this.parseKriya())
      else {
        const t = this.peek()
        throw new ParseError(`Expected 'smriti', 'sutra', or 'kriya', got '${t.value}'`, t.pos)
      }
    }
    return { kind: 'file', decls, pos }
  }

  private parseSmriti(): SmritiDecl {
    const pos = this.pos()
    this.eat(TokenKind.SMRITI)
    const name = this.eat(TokenKind.IDENTIFIER, 'smriti declaration').value
    this.eat(TokenKind.LBRACE, `smriti '${name}'`)

    const metadata = this.parseMetadata()
    const aagama = this.tryEat(TokenKind.AAGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined
    const nirgama = this.tryEat(TokenKind.NIRGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined
    const references = this.parseReferences()
    const participants = this.parseParticipants()
    const kriya = this.parseKriyaDecls()
    const sthitiBlock = this.check(TokenKind.STHITI) && this.tokens[this.i + 1]?.kind === TokenKind.LBRACE
      ? this.parseSthitiBlock() : undefined
    const trigger = this.check(TokenKind.GHATANA) ? this.parseGhatana() : undefined
    const flow = this.check(TokenKind.PRAVAH) ? this.parseFlow() : undefined

    this.eat(TokenKind.RBRACE, `smriti '${name}'`)
    const itiName = this.tryEatIti()
    return { kind: 'smriti', name, itiName, metadata, references, participants, kriya, sthitiBlock, trigger, aagama, nirgama, flow, pos }
  }

  private parseSutra(): SutraDecl {
    const pos = this.pos()
    this.eat(TokenKind.SUTRA)
    const name = this.eat(TokenKind.IDENTIFIER, 'sutra declaration').value
    const parent = this.tryEat(TokenKind.ANUVRTTI) ? this.parseNameRef() : undefined
    this.eat(TokenKind.LBRACE, `sutra '${name}'`)

    const metadata = this.parseMetadata()
    const aagama = this.tryEat(TokenKind.AAGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined
    const kriya = this.parseKriyaDecls()
    const sthitiBlock = this.check(TokenKind.STHITI) && this.tokens[this.i + 1]?.kind === TokenKind.LBRACE
      ? this.parseSthitiBlock() : undefined
    const flow = this.parseFlow()
    const nirgama = this.tryEat(TokenKind.NIRGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined

    this.eat(TokenKind.RBRACE, `sutra '${name}'`)
    const itiName = this.tryEatIti()
    return { kind: 'sutra', name, itiName, metadata, parent, aagama, kriya, sthitiBlock, flow, nirgama, pos }
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────

  private parseMetadata(): Metadata {
    const pos = this.pos()
    const meta: Metadata = { kind: 'metadata', pos }
    const METADATA_TOKENS = new Set([
      TokenKind.ADHIPATI, TokenKind.AAVARTANA, TokenKind.STARA,
      TokenKind.PRABHAAVA, TokenKind.STHALA, TokenKind.KSHETRA, TokenKind.AVADHI,
    ])
    while (METADATA_TOKENS.has(this.peek().kind)) {
      switch (this.advance().kind) {
        case TokenKind.ADHIPATI:
          this.eat(TokenKind.COLON); meta.adhipati = this.eat(TokenKind.STRING).value; break
        case TokenKind.AAVARTANA:
          this.eat(TokenKind.COLON); meta.aavartana = this.eat(TokenKind.VERSION).value; break
        case TokenKind.STARA:
          this.eat(TokenKind.COLON)
          const sv = this.advance()
          if (sv.kind !== TokenKind.PUBLIC && sv.kind !== TokenKind.RESTRICTED && sv.kind !== TokenKind.PRIVATE)
            throw new ParseError(`Expected 'public', 'restricted', or 'private'`, sv.pos)
          meta.stara = sv.kind as 'public' | 'restricted' | 'private'; break
        case TokenKind.PRABHAAVA:
          this.eat(TokenKind.COLON); meta.prabhaava = this.eat(TokenKind.DATE).value; break
        case TokenKind.STHALA:
          this.eat(TokenKind.COLON); meta.sthala = this.eat(TokenKind.STRING).value; break
        case TokenKind.KSHETRA:
          this.eat(TokenKind.COLON); meta.kshetra = this.eat(TokenKind.STRING).value; break
        case TokenKind.AVADHI:
          this.eat(TokenKind.COLON)
          meta.avadhi = parseFloat(this.eat(TokenKind.NUMBER).value)
          this.eat(TokenKind.ANTARA); break
      }
    }
    return meta
  }

  // ─── References ─────────────────────────────────────────────────────────────

  private parseReferences(): ReferenceDecl[] {
    const refs: ReferenceDecl[] = []
    while (this.check(TokenKind.SANGAMA) || this.check(TokenKind.LAGNA)) {
      if (this.check(TokenKind.SANGAMA)) refs.push(this.parseSangama())
      else refs.push(this.parseLagna())
    }
    return refs
  }

  private parseSangama(): SangamaDecl {
    const pos = this.pos()
    this.eat(TokenKind.SANGAMA)
    const name = this.eat(TokenKind.IDENTIFIER).value
    this.eat(TokenKind.LBRACE)
    this.eat(TokenKind.YUJA); this.eat(TokenKind.COLON)
    const yuja = this.eat(TokenKind.STRING).value
    this.eat(TokenKind.RBRACE)
    return { kind: 'sangama', name, yuja, pos }
  }

  private parseLagna(): LagnaDecl {
    const pos = this.pos()
    this.eat(TokenKind.LAGNA)
    const name = this.eat(TokenKind.IDENTIFIER).value
    this.eat(TokenKind.LBRACE)
    this.eat(TokenKind.YUJA); this.eat(TokenKind.COLON)
    const yuja = this.eat(TokenKind.STRING).value
    let adhipati: string | undefined
    let aavartana: string | undefined
    if (this.tryEat(TokenKind.ADHIPATI)) { this.eat(TokenKind.COLON); adhipati = this.eat(TokenKind.STRING).value }
    if (this.tryEat(TokenKind.AAVARTANA)) { this.eat(TokenKind.COLON); aavartana = this.eat(TokenKind.VERSION).value }
    this.eat(TokenKind.RBRACE)
    return { kind: 'lagna', name, yuja, adhipati, aavartana, pos }
  }

  // ─── Participants ────────────────────────────────────────────────────────────

  private parseParticipants(): PakshaDecl[] {
    const participants: PakshaDecl[] = []
    while (this.check(TokenKind.PAKSHA)) participants.push(this.parsePaksha())
    return participants
  }

  private parsePaksha(): PakshaDecl {
    const pos = this.pos()
    this.eat(TokenKind.PAKSHA)
    const name = this.eat(TokenKind.IDENTIFIER, 'paksha').value
    this.eat(TokenKind.LBRACE, `paksha '${name}'`)

    let bhumika: string | undefined
    const adhikara: string[] = []
    let pramana: string | undefined

    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.tryEat(TokenKind.BHUMIKA)) {
        this.eat(TokenKind.COLON); bhumika = this.eat(TokenKind.IDENTIFIER).value
      } else if (this.tryEat(TokenKind.ADHIKARA)) {
        this.eat(TokenKind.COLON)
        adhikara.push(this.eat(TokenKind.IDENTIFIER).value)
        while (this.tryEat(TokenKind.COMMA)) adhikara.push(this.eat(TokenKind.IDENTIFIER).value)
      } else if (this.tryEat(TokenKind.PRAMANA)) {
        this.eat(TokenKind.COLON); pramana = this.eat(TokenKind.STRING).value
      } else break
    }

    this.eat(TokenKind.RBRACE, `paksha '${name}'`)
    const itiName = this.tryEatIti()
    return { kind: 'paksha', name, itiName, bhumika, adhikara, pramana, pos }
  }

  // ─── Trigger ────────────────────────────────────────────────────────────────

  private parseGhatana(): GhatanaDecl {
    const pos = this.pos()
    this.eat(TokenKind.GHATANA)
    this.eat(TokenKind.LBRACE, 'ghatana')

    let vrtti:  Expression    | undefined
    let hetu:   HetuSchedule  | undefined
    let karta:  Expression    | undefined
    let sthala: Expression    | undefined
    let kaarya: Expression    | undefined

    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.tryEat(TokenKind.VRTTI)) {
        this.eat(TokenKind.COLON, 'vrtti'); vrtti = this.parseExpression()
      } else if (this.tryEat(TokenKind.HETU)) {
        this.eat(TokenKind.COLON, 'hetu')
        const hp = this.pos()
        this.eat(TokenKind.PRATI, 'hetu schedule — expected: prati N <unit>')
        const quantity = parseFloat(this.eat(TokenKind.NUMBER, 'hetu schedule quantity').value)
        // unit is user-defined — accept any word token (keywords like 'antara' are valid units)
        const unitTok = this.peek()
        if (unitTok.kind !== TokenKind.IDENTIFIER && !unitTok.value.match(/^[a-zA-Z]/)) {
          throw new ParseError(`Expected unit name in hetu schedule, got '${unitTok.value || unitTok.kind}'`, unitTok.pos)
        }
        this.advance()
        const unit = unitTok.value
        hetu = { kind: 'hetu-schedule', quantity, unit, pos: hp }
      } else if (this.tryEat(TokenKind.KARTA)) {
        this.eat(TokenKind.COLON, 'karta'); karta = this.parseExpression()
      } else if (this.tryEat(TokenKind.STHALA)) {
        this.eat(TokenKind.COLON, 'sthala'); sthala = this.parseExpression()
      } else if (this.tryEat(TokenKind.KAARYA)) {
        this.eat(TokenKind.COLON, 'kaarya'); kaarya = this.parseExpression()
      } else break
    }

    this.eat(TokenKind.RBRACE, 'ghatana')
    return { kind: 'ghatana', vrtti, hetu, karta, sthala, kaarya, pos }
  }

  // ─── Flow ───────────────────────────────────────────────────────────────────

  private parseFlow(): FlowDecl {
    const pos = this.pos()
    this.eat(TokenKind.PRAVAH, 'flow declaration')
    this.eat(TokenKind.LBRACE, 'pravah')
    const items: FlowItem[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      items.push(this.parseFlowItem())
    }
    this.eat(TokenKind.RBRACE, 'pravah')
    return { kind: 'pravah', items, pos }
  }

  private parseFlowItem(): FlowItem {
    const t = this.peek()
    switch (t.kind) {
      case TokenKind.PADA:      return this.parsePada()
      case TokenKind.AADESHA:   return this.parseAadesha()
      case TokenKind.VIBHAGA:   return this.parseVibhaga()
      case TokenKind.ANUBHAGA:  return this.parseAnubhaga()
      case TokenKind.ANUGAMA:   return this.parseAnugama()
      case TokenKind.AAVAHA:    return this.parseAavaha()
      case TokenKind.VARNA:     return this.parseVarna()
      case TokenKind.STHITI:    return this.parseSthiti()
      case TokenKind.SVASTI:    this.advance(); return { kind: 'svasti', pos: t.pos }
      case TokenKind.ANAAPTA:   this.advance(); return { kind: 'anaapta', pos: t.pos }
      default:
        throw new ParseError(`Unexpected token '${t.value}' in pravah`, t.pos)
    }
  }

  private parseAadesha(): AadeshaDecl {
    const pos = this.pos()
    this.eat(TokenKind.AADESHA)
    const target = this.eat(TokenKind.IDENTIFIER, 'aadesha target step name').value
    // Parse the replacement step body as a pada, but the name IS the target
    this.eat(TokenKind.LBRACE, `aadesha '${target}'`)
    const pada = this.parsePadaBody(target, pos)
    this.eat(TokenKind.RBRACE, `aadesha '${target}'`)
    return { kind: 'aadesha', target, pada, pos }
  }

  // ─── Step ───────────────────────────────────────────────────────────────────

  private parsePada(): PadaDecl {
    const pos = this.pos()
    this.eat(TokenKind.PADA)
    const name = this.eat(TokenKind.IDENTIFIER, 'pada').value
    this.eat(TokenKind.LBRACE, `pada '${name}'`)
    const pada = this.parsePadaBody(name, pos)
    this.eat(TokenKind.RBRACE, `pada '${name}'`)
    pada.itiName = this.tryEatIti()
    return pada
  }

  private parsePadaBody(name: string, pos: Pos): PadaDecl {
    let karta: NameRef | undefined
    let kaarya: string | CallExpr | undefined
    let aagama: TypedField[] = []
    let nirgama: TypedField[] = []
    let samaya: Duration | undefined
    let khanda: Expression | undefined
    let apavaada: string | undefined
    let apavaadaNirgama: TypedField[] | undefined
    let samapti: string | undefined
    let samaptiNirgama: TypedField[] | undefined
    let routing: PravrttiDecl | PrativrttiDecl | undefined

    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.tryEat(TokenKind.KARTA)) {
        this.eat(TokenKind.COLON); karta = this.parseNameRef()
      } else if (this.tryEat(TokenKind.KAARYA)) {
        this.eat(TokenKind.COLON)
        if (this.check(TokenKind.KRIYA)) {
          // kriya invocation: kaarya: kriya name(args)
          const callPos = this.pos(); this.advance()
          const callee = this.parseNameRef()
          this.eat(TokenKind.LPAREN, 'kriya invocation in kaarya')
          const args = this.parseArgList()
          this.eat(TokenKind.RPAREN, 'kriya invocation in kaarya')
          kaarya = { kind: 'call', callee, args, pos: callPos } satisfies CallExpr
        } else {
          kaarya = this.eat(TokenKind.STRING).value
        }
      } else if (this.tryEat(TokenKind.AAGAMA)) {
        this.eat(TokenKind.COLON); aagama = this.parseTypedFields()
      } else if (this.tryEat(TokenKind.NIRGAMA)) {
        this.eat(TokenKind.COLON); nirgama = this.parseTypedFields()
      } else if (this.tryEat(TokenKind.SAMAYA)) {
        this.eat(TokenKind.COLON); samaya = this.parseDuration()
      } else if (this.tryEat(TokenKind.KHANDA)) {
        this.eat(TokenKind.COLON); khanda = this.parseExpression()
      } else if (this.tryEat(TokenKind.APAVAADA)) {
        if (this.check(TokenKind.ARROW)) {
          // apavaada → target : exception routing
          this.eat(TokenKind.ARROW)
          const vt = this.peek()
          apavaada = (vt.kind === TokenKind.SVASTI || vt.kind === TokenKind.ANAAPTA)
            ? this.advance().value
            : this.eat(TokenKind.IDENTIFIER, 'apavaada target').value
        } else {
          // apavaada: fields : error data produced for the exception handler
          this.eat(TokenKind.COLON, 'apavaada data fields')
          apavaadaNirgama = this.parseTypedFields()
        }
      } else if (this.tryEat(TokenKind.SAMAPTI)) {
        if (this.check(TokenKind.ARROW)) {
          // samapti → target : timeout routing
          this.eat(TokenKind.ARROW)
          const kt = this.peek()
          samapti = (kt.kind === TokenKind.SVASTI || kt.kind === TokenKind.ANAAPTA)
            ? this.advance().value
            : this.eat(TokenKind.IDENTIFIER, 'samapti target').value
        } else {
          // samapti: fields : timeout data produced for the timeout handler
          this.eat(TokenKind.COLON, 'samapti data fields')
          samaptiNirgama = this.parseTypedFields()
        }
      } else if (this.check(TokenKind.PRAVRITTI)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        routing = { kind: 'pravritti', target: this.eat(TokenKind.IDENTIFIER).value, pos: p }
      } else if (this.check(TokenKind.PRATIVRITTI)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        routing = { kind: 'prativritti', target: this.eat(TokenKind.IDENTIFIER).value, pos: p }
      } else break
    }

    return { kind: 'pada', name, karta, kaarya, aagama, nirgama, samaya, khanda,
             apavaada, apavaadaNirgama, samapti, samaptiNirgama, routing, pos }
  }

  private parseDuration(): Duration {
    const pos = this.pos()
    const value = parseFloat(this.eat(TokenKind.NUMBER).value)
    const unitToken = this.advance()
    if (unitToken.kind !== TokenKind.ANTARA && unitToken.kind !== TokenKind.TITHI)
      throw new ParseError(`Expected time unit 'antara' or 'tithi'`, unitToken.pos)
    return { kind: 'duration', value, unit: unitToken.kind as 'antara' | 'tithi', pos }
  }

  // ─── Branching ──────────────────────────────────────────────────────────────

  private parseVibhaga(): VibhagaDecl {
    const pos = this.pos()
    this.eat(TokenKind.VIBHAGA)
    const on = this.eat(TokenKind.IDENTIFIER, 'vibhaga').value
    this.eat(TokenKind.LBRACE, `vibhaga '${on}'`)
    const clauses: NiyamaClause[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      clauses.push(this.parseNiyama())
    }
    if (clauses.length === 0)
      throw new ParseError(`vibhaga '${on}' has no niyama clauses`, pos)
    this.eat(TokenKind.RBRACE, `vibhaga '${on}'`)
    const itiName = this.tryEatIti()
    return { kind: 'vibhaga', on, itiName, clauses, pos }
  }

  private parseNiyama(): NiyamaClause {
    const pos = this.pos()
    this.eat(TokenKind.NIYAMA, 'vibhaga')
    const condition = this.parseExpression()
    this.eat(TokenKind.ARROW, 'niyama clause')
    const target = this.parseBranchTarget()
    return { kind: 'niyama', condition, target, pos }
  }

  private parseBranchTarget(): string {
    if (this.check(TokenKind.SVASTI)) { this.advance(); return 'svasti' }
    if (this.check(TokenKind.ANAAPTA)) { this.advance(); return 'anaapta' }
    return this.eat(TokenKind.IDENTIFIER, 'branch target').value
  }

  // ─── Parallel ───────────────────────────────────────────────────────────────

  private parseAnubhaga(): AnubhagaDecl {
    const pos = this.pos()
    this.eat(TokenKind.ANUBHAGA)
    const tracks: FlowItem[][] = []
    this.eat(TokenKind.LBRACE, 'anubhaga')
    const track: FlowItem[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF))
      track.push(this.parseFlowItem())
    tracks.push(track)
    this.eat(TokenKind.RBRACE, 'anubhaga track')
    while (this.tryEat(TokenKind.COMMA)) {
      this.eat(TokenKind.LBRACE, 'anubhaga track')
      const t: FlowItem[] = []
      while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF))
        t.push(this.parseFlowItem())
      this.eat(TokenKind.RBRACE, 'anubhaga track')
      tracks.push(t)
    }
    return { kind: 'anubhaga', tracks, pos }
  }

  private parseAnugama(): AnugamaDecl {
    const pos = this.pos()
    this.eat(TokenKind.ANUGAMA)
    const tracks: string[] = [this.eat(TokenKind.IDENTIFIER, 'anugama').value]
    while (this.check(TokenKind.IDENTIFIER)) tracks.push(this.advance().value)
    return { kind: 'anugama', tracks, pos }
  }

  // ─── Sub-process & state ────────────────────────────────────────────────────

  private parseAavaha(): AavahaDecl {
    const pos = this.pos()
    this.eat(TokenKind.AAVAHA)
    const target = this.parseNameRef()
    let aagama: TypedField[] = []
    let nirgama: TypedField[] = []
    if (this.tryEat(TokenKind.AAGAMA)) { this.eat(TokenKind.COLON); aagama = this.parseTypedFields() }
    if (this.tryEat(TokenKind.NIRGAMA)) { this.eat(TokenKind.COLON); nirgama = this.parseTypedFields() }
    return { kind: 'aavaha', target, aagama, nirgama, pos }
  }

  private parseSthiti(): SthitiDecl {
    const pos = this.pos()
    this.eat(TokenKind.STHITI)
    const name = this.eat(TokenKind.IDENTIFIER, 'sthiti').value
    return { kind: 'sthiti', name, pos }
  }

  private parseVarna(): VarnaDecl {
    const pos = this.pos()
    this.eat(TokenKind.VARNA)
    const name = this.eat(TokenKind.IDENTIFIER, 'varna').value
    this.eat(TokenKind.COLON, `varna '${name}'`)
    const varnaType = this.parseType()
    const expr = this.tryEat(TokenKind.EQ) ? this.parseExpression() : undefined
    return { kind: 'varna', name, varnaType, expr, pos }
  }

  // ─── Types ──────────────────────────────────────────────────────────────────

  private parseTypedFields(): TypedField[] {
    const fields: TypedField[] = [this.parseTypedField()]
    while (this.tryEat(TokenKind.COMMA)) fields.push(this.parseTypedField())
    return fields
  }

  private parseTypedField(): TypedField {
    const pos = this.pos()
    const optional = !!this.tryEat(TokenKind.VIKALPA)
    const name = this.eat(TokenKind.IDENTIFIER, 'typed field').value
    this.eat(TokenKind.LPAREN, `field '${name}'`)
    const type = this.parseType()
    this.eat(TokenKind.RPAREN, `field '${name}'`)
    return { kind: 'typed-field', name, type, optional, pos }
  }

  private parseType(): SmritiType {
    const t = this.advance()
    switch (t.kind) {
      case TokenKind.SANKHYA: {
        // Optional range constraint: sankhya min..max | sankhya min.. | sankhya ..max
        let min: number | undefined
        let max: number | undefined
        if (this.check(TokenKind.NUMBER)) {
          min = parseFloat(this.advance().value)
          if (this.tryEat(TokenKind.DOTDOT)) {
            if (this.check(TokenKind.NUMBER)) max = parseFloat(this.advance().value)
          }
        } else if (this.tryEat(TokenKind.DOTDOT)) {
          if (this.check(TokenKind.NUMBER)) max = parseFloat(this.advance().value)
        }
        return { kind: 'sankhya', ...(min !== undefined && { min }), ...(max !== undefined && { max }) }
      }
      case TokenKind.BHINNAANKA: return { kind: 'bhinnaanka' }
      case TokenKind.DASHAAMSHA: return { kind: 'dashaamsha' }
      case TokenKind.VAKYA: {
        // Optional regex pattern constraint: vakya "pattern"
        const pattern = this.check(TokenKind.STRING) ? this.advance().value : undefined
        return { kind: 'vakya', ...(pattern !== undefined && { pattern }) }
      }
      case TokenKind.TITHI:      return { kind: 'tithi' }
      case TokenKind.ANTARA:     return { kind: 'antara' }
      case TokenKind.TARKA:      return { kind: 'tarka' }
      case TokenKind.PATRA:      return { kind: 'patra' }
      case TokenKind.KRAMA: {
        this.eat(TokenKind.LBRACKET, 'krama type')
        const of_ = this.parseType()
        this.eat(TokenKind.RBRACKET, 'krama type')
        return { kind: 'krama', of: of_ }
      }
      case TokenKind.KOSA: {
        this.eat(TokenKind.LBRACKET, 'kosa type')
        const key = this.parseType()
        this.eat(TokenKind.COMMA, 'kosa type')
        const value = this.parseType()
        this.eat(TokenKind.RBRACKET, 'kosa type')
        return { kind: 'kosa', key, value }
      }
      default:
        throw new ParseError(`Expected a type, got '${t.value}'`, t.pos)
    }
  }

  // ─── Expressions ─────────────────────────────────────────────────────────────
  // Recursive descent (low to high precedence):
  //   logical_or > logical_and > comparison > additive > multiplicative > unary > primary

  private parseExpression(): Expression { return this.parseLogicalOr() }

  private parseLogicalOr(): Expression {
    let left = this.parseLogicalAnd()
    while (this.check(TokenKind.OR)) {
      const op = this.advance().kind as LogicalOp
      const right = this.parseLogicalAnd()
      left = { kind: 'logical', left, op, right, pos: left.pos } satisfies LogicalExpr
    }
    return left
  }

  private parseLogicalAnd(): Expression {
    let left = this.parseComparison()
    while (this.check(TokenKind.AND)) {
      const op = this.advance().kind as LogicalOp
      const right = this.parseComparison()
      left = { kind: 'logical', left, op, right, pos: left.pos } satisfies LogicalExpr
    }
    return left
  }

  private parseComparison(): Expression {
    const left = this.parseAdditive()
    const CMP_OPS: TokenKind[] = [
      TokenKind.EQEQ, TokenKind.NEQ,
      TokenKind.LT, TokenKind.GT, TokenKind.LTE, TokenKind.GTE,
    ]
    if (CMP_OPS.includes(this.peek().kind)) {
      const op = this.advance().value as CompareOp
      const right = this.parseAdditive()
      return { kind: 'compare', left, op, right, pos: left.pos } satisfies CompareExpr
    }
    return left
  }

  private parseAdditive(): Expression {
    let left = this.parseMultiplicative()
    while (this.check(TokenKind.PLUS) || this.check(TokenKind.MINUS)) {
      const op = this.advance().value as ArithOp
      const right = this.parseMultiplicative()
      left = { kind: 'arith', left, op, right, pos: left.pos } satisfies ArithExpr
    }
    return left
  }

  private parseMultiplicative(): Expression {
    let left = this.parseUnary()
    while (this.check(TokenKind.STAR) || this.check(TokenKind.SLASH) || this.check(TokenKind.PERCENT)) {
      const op = this.advance().value as ArithOp
      const right = this.parseUnary()
      left = { kind: 'arith', left, op, right, pos: left.pos } satisfies ArithExpr
    }
    return left
  }

  private parseUnary(): Expression {
    if (this.check(TokenKind.BANG)) {
      const pos = this.advance().pos
      const operand = this.parseUnary()
      return { kind: 'not', operand, pos } satisfies NotExpr
    }
    if (this.check(TokenKind.MINUS)) {
      const pos = this.advance().pos
      const operand = this.parseUnary()
      return { kind: 'negate', operand, pos } satisfies NegateExpr
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    const t = this.peek()

    // Tarka literals
    if (t.kind === TokenKind.SATYA || t.kind === TokenKind.ASATYA || t.kind === TokenKind.AVYAKTA) {
      this.advance()
      return { kind: 'tarka-literal', value: t.kind as 'satya' | 'asatya' | 'avyakta', pos: t.pos } satisfies TarkaLiteral
    }

    // Number literal
    if (t.kind === TokenKind.NUMBER) {
      this.advance()
      return { kind: 'number-literal', value: parseFloat(t.value), pos: t.pos } satisfies NumberLiteral
    }

    // String literal
    if (t.kind === TokenKind.STRING) {
      this.advance()
      return { kind: 'string-literal', value: t.value, pos: t.pos } satisfies StringLiteral
    }

    // Parenthesised expression
    if (this.check(TokenKind.LPAREN)) {
      this.advance()
      const inner = this.parseExpression()
      this.eat(TokenKind.RPAREN, 'closing ) in expression')
      return inner
    }

    // Identifier — may be a plain reference, a local call, or a qualified call
    const first = this.eat(TokenKind.IDENTIFIER, 'expression').value

    if (this.check(TokenKind.DOT)) {
      // Qualified name: namespace.member — must be a call in expression position
      this.advance()
      const member = this.eat(TokenKind.IDENTIFIER, 'qualified name in expression').value
      const callee: NameRef = { namespace: first, name: member }
      this.eat(TokenKind.LPAREN, `qualified call '${first}.${member}'`)
      const args = this.parseArgList()
      this.eat(TokenKind.RPAREN, `qualified call '${first}.${member}'`)
      return { kind: 'call', callee, args, pos: t.pos } satisfies CallExpr
    }

    if (this.check(TokenKind.LPAREN)) {
      // Local call: name(args)
      this.advance()
      const args = this.parseArgList()
      this.eat(TokenKind.RPAREN, `call '${first}'`)
      return { kind: 'call', callee: first, args, pos: t.pos } satisfies CallExpr
    }

    return { kind: 'identifier', name: first, pos: t.pos } satisfies IdentifierExpr
  }

  // ─── Computation (kriya) ─────────────────────────────────────────────────────

  private parseKriyaDecls(): KriyaDecl[] {
    const decls: KriyaDecl[] = []
    while (this.check(TokenKind.KRIYA)) decls.push(this.parseKriya())
    return decls
  }

  private parseKriya(): KriyaDecl {
    const pos = this.pos()
    this.eat(TokenKind.KRIYA)
    const name = this.eat(TokenKind.IDENTIFIER, 'kriya declaration').value
    this.eat(TokenKind.LBRACE, `kriya '${name}'`)

    // Permissive ordering: header sections (sparsha/aagama/nirgama/sthiti) and body
    // statements may appear in any order. Keyword tokens dispatch to the right handler;
    // everything else is a statement.
    let sparsha: SparshaDecl | undefined
    let aagama: TypedField[] = []
    let nirgama: TypedField[] = []
    let sthitiBlock: SthitiBlock | undefined
    const body: KriyaStmt[] = []

    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.check(TokenKind.SPARSHA)) {
        sparsha = this.parseSparsha()
      } else if (this.check(TokenKind.AAGAMA)) {
        this.advance(); this.eat(TokenKind.COLON, `kriya '${name}' aagama`)
        aagama = this.parseTypedFields()
      } else if (this.check(TokenKind.NIRGAMA)) {
        this.advance(); this.eat(TokenKind.COLON, `kriya '${name}' nirgama`)
        nirgama = this.parseTypedFields()
      } else if (this.check(TokenKind.STHITI) && this.tokens[this.i + 1]?.kind === TokenKind.LBRACE) {
        sthitiBlock = this.parseSthitiBlock()
      } else {
        body.push(this.parseKriyaStmt())
      }
    }

    this.eat(TokenKind.RBRACE, `kriya '${name}'`)
    const itiName = this.tryEatIti()
    return { kind: 'kriya', name, itiName, sparsha, aagama, nirgama, sthitiBlock, body, pos }
  }

  private parseSparsha(): SparshaDecl {
    const pos = this.pos()
    this.eat(TokenKind.SPARSHA)
    this.eat(TokenKind.LBRACE, 'sparsha')
    const fields: SparshaField[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      const fpos = this.pos()
      const channelTok = this.advance()
      const channel = channelTok.value as EffectChannel
      this.eat(TokenKind.COLON, 'sparsha field')
      const modeTok = this.advance()
      const mode = modeTok.value as EffectMode
      fields.push({ kind: 'sparsha-field', channel, mode, pos: fpos })
    }
    this.eat(TokenKind.RBRACE, 'sparsha')
    return { kind: 'sparsha', fields, pos }
  }

  private parseKriyaBody(): KriyaStmt[] {
    const stmts: KriyaStmt[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      stmts.push(this.parseKriyaStmt())
    }
    return stmts
  }

  private parseKriyaStmt(): KriyaStmt {
    const pos = this.pos()
    // Lookahead: IDENTIFIER followed immediately by EQ (=) → assign-stmt.
    // EQ is always single = (EQEQ == is a distinct token), so no ambiguity.
    if (this.check(TokenKind.IDENTIFIER) && this.tokens[this.i + 1]?.kind === TokenKind.EQ) {
      const name = this.advance().value
      this.eat(TokenKind.EQ, `assignment to '${name}'`)
      const expr = this.parseExpression()
      return { kind: 'assign', name, expr, pos } satisfies AssignStmt
    }
    const expr = this.parseExpression()
    return { kind: 'expr-stmt', expr, pos } satisfies ExprStmt
  }

  // ─── State (sthiti-block) ────────────────────────────────────────────────────

  private parseSthitiBlock(): SthitiBlock {
    const pos = this.pos()
    this.eat(TokenKind.STHITI, 'sthiti block')
    this.eat(TokenKind.LBRACE, 'sthiti block')
    const fields: SthitiField[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      const fpos = this.pos()
      const optional = this.tryEat(TokenKind.VIKALPA) !== null
      const name = this.eat(TokenKind.IDENTIFIER, 'sthiti field name').value
      this.eat(TokenKind.LPAREN, `sthiti field '${name}'`)
      const type = this.parseType()
      this.eat(TokenKind.RPAREN, `sthiti field '${name}'`)
      const init = this.tryEat(TokenKind.EQ) ? this.parseExpression() : undefined
      fields.push({ kind: 'sthiti-field', name, type, optional, init, pos: fpos })
    }
    this.eat(TokenKind.RBRACE, 'sthiti block')
    return { kind: 'sthiti-block', fields, pos }
  }

  private parseArgList(): Expression[] {
    const args: Expression[] = []
    if (!this.check(TokenKind.RPAREN)) {
      args.push(this.parseExpression())
      while (this.tryEat(TokenKind.COMMA)) args.push(this.parseExpression())
    }
    return args
  }
}

export function parse(source: string): SmritiFile {
  const tokens = lex(source)
  return new Parser(tokens).parseFile()
}
