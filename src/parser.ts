import { lex, TokenKind, type Token } from './lexer.js'
import type {
  SmritiFile, SmritiDecl, SutraDecl,
  Metadata, ReferenceDecl, SangamaDecl, LagnaDecl,
  PakshaDecl, GhatanaDecl, VrttiDecl, HetuDecl,
  FlowDecl, FlowItem, PadaDecl, Duration,
  VibhagaDecl, NiyamaClause, AnubhagaDecl, AnugamaDecl,
  AavahaDecl, SthitiDecl, TypedField, SmritiType,
  Expression, TarkaLiteral, IdentifierExpr,
  PravrttiDecl, PrativrttiDecl, Pos,
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

  // ─── Top level ──────────────────────────────────────────────────────────────

  parseFile(): SmritiFile {
    const pos = this.pos()
    const decls: (SmritiDecl | SutraDecl)[] = []
    while (!this.check(TokenKind.EOF)) {
      if (this.check(TokenKind.SMRITI)) decls.push(this.parseSmriti())
      else if (this.check(TokenKind.SUTRA)) decls.push(this.parseSutra())
      else {
        const t = this.peek()
        throw new ParseError(`Expected 'smriti' or 'sutra', got '${t.value}'`, t.pos)
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
    const references = this.parseReferences()
    const participants = this.parseParticipants()
    const trigger = this.check(TokenKind.GHATANA) ? this.parseGhatana() : undefined
    const flow = this.parseFlow()

    this.eat(TokenKind.RBRACE, `smriti '${name}'`)
    return { kind: 'smriti', name, metadata, references, participants, trigger, flow, pos }
  }

  private parseSutra(): SutraDecl {
    const pos = this.pos()
    this.eat(TokenKind.SUTRA)
    const name = this.eat(TokenKind.IDENTIFIER, 'sutra declaration').value
    this.eat(TokenKind.LBRACE, `sutra '${name}'`)

    const metadata = this.parseMetadata()
    const aagama = this.tryEat(TokenKind.AAGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined
    const flow = this.parseFlow()
    const nirgama = this.tryEat(TokenKind.NIRGAMA)
      ? (this.eat(TokenKind.COLON), this.parseTypedFields())
      : undefined

    this.eat(TokenKind.RBRACE, `sutra '${name}'`)
    return { kind: 'sutra', name, metadata, aagama, flow, nirgama, pos }
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
    return { kind: 'paksha', name, bhumika, adhikara, pramana, pos }
  }

  // ─── Trigger ────────────────────────────────────────────────────────────────

  private parseGhatana(): GhatanaDecl {
    const pos = this.pos()
    this.eat(TokenKind.GHATANA)
    this.eat(TokenKind.LBRACE, 'ghatana')
    const items: (VrttiDecl | HetuDecl)[] = []
    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.check(TokenKind.VRTTI)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        items.push({ kind: 'vrtti', description: this.parseDescription(), pos: p })
      } else if (this.check(TokenKind.HETU)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        items.push({ kind: 'hetu', description: this.parseDescription(), pos: p })
      } else break
    }
    this.eat(TokenKind.RBRACE, 'ghatana')
    return { kind: 'ghatana', items, pos }
  }

  private parseDescription(): string {
    if (this.check(TokenKind.STRING)) return this.advance().value
    let desc = this.eat(TokenKind.IDENTIFIER).value
    while (this.check(TokenKind.IDENTIFIER)) desc += ' ' + this.advance().value
    return desc
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
      case TokenKind.VIBHAGA:   return this.parseVibhaga()
      case TokenKind.ANUBHAGA:  return this.parseAnubhaga()
      case TokenKind.ANUGAMA:   return this.parseAnugama()
      case TokenKind.AAVAHA:    return this.parseAavaha()
      case TokenKind.STHITI:    return this.parseSthiti()
      case TokenKind.SVASTI:    this.advance(); return { kind: 'svasti', pos: t.pos }
      case TokenKind.ANAAPTA:   this.advance(); return { kind: 'anaapta', pos: t.pos }
      default:
        throw new ParseError(`Unexpected token '${t.value}' in pravah`, t.pos)
    }
  }

  // ─── Step ───────────────────────────────────────────────────────────────────

  private parsePada(): PadaDecl {
    const pos = this.pos()
    this.eat(TokenKind.PADA)
    const name = this.eat(TokenKind.IDENTIFIER, 'pada').value
    this.eat(TokenKind.LBRACE, `pada '${name}'`)

    let karta: string | undefined
    let kaarya: string | undefined
    let aagama: TypedField[] = []
    let nirgama: TypedField[] = []
    let samaya: Duration | undefined
    let khanda: Expression | undefined
    let routing: PravrttiDecl | PrativrttiDecl | undefined

    while (!this.check(TokenKind.RBRACE) && !this.check(TokenKind.EOF)) {
      if (this.tryEat(TokenKind.KARTA)) {
        this.eat(TokenKind.COLON); karta = this.eat(TokenKind.IDENTIFIER).value
      } else if (this.tryEat(TokenKind.KAARYA)) {
        this.eat(TokenKind.COLON); kaarya = this.eat(TokenKind.STRING).value
      } else if (this.tryEat(TokenKind.AAGAMA)) {
        this.eat(TokenKind.COLON); aagama = this.parseTypedFields()
      } else if (this.tryEat(TokenKind.NIRGAMA)) {
        this.eat(TokenKind.COLON); nirgama = this.parseTypedFields()
      } else if (this.tryEat(TokenKind.SAMAYA)) {
        this.eat(TokenKind.COLON); samaya = this.parseDuration()
      } else if (this.tryEat(TokenKind.KHANDA)) {
        this.eat(TokenKind.COLON); khanda = this.parseExpression()
      } else if (this.check(TokenKind.PRAVRITTI)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        routing = { kind: 'pravritti', target: this.eat(TokenKind.IDENTIFIER).value, pos: p }
      } else if (this.check(TokenKind.PRATIVRITTI)) {
        const p = this.pos(); this.advance(); this.eat(TokenKind.COLON)
        routing = { kind: 'prativritti', target: this.eat(TokenKind.IDENTIFIER).value, pos: p }
      } else break
    }

    this.eat(TokenKind.RBRACE, `pada '${name}'`)
    return { kind: 'pada', name, karta, kaarya, aagama, nirgama, samaya, khanda, routing, pos }
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
    return { kind: 'vibhaga', on, clauses, pos }
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
    const target = this.eat(TokenKind.IDENTIFIER, 'aavaha').value
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
      case TokenKind.SANKHYA:    return { kind: 'sankhya' }
      case TokenKind.BHINNAANKA: return { kind: 'bhinnaanka' }
      case TokenKind.DASHAAMSHA: return { kind: 'dashaamsha' }
      case TokenKind.VAKYA:      return { kind: 'vakya' }
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

  // ─── Expressions ────────────────────────────────────────────────────────────

  private parseExpression(): Expression {
    const t = this.peek()
    if (t.kind === TokenKind.SATYA || t.kind === TokenKind.ASATYA || t.kind === TokenKind.AVYAKTA) {
      this.advance()
      return { kind: 'tarka-literal', value: t.kind as 'satya' | 'asatya' | 'avyakta', pos: t.pos }
    }
    const name = this.eat(TokenKind.IDENTIFIER, 'expression').value
    return { kind: 'identifier', name, pos: t.pos }
  }
}

export function parse(source: string): SmritiFile {
  const tokens = lex(source)
  return new Parser(tokens).parseFile()
}
