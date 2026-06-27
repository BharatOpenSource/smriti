import type { Pos } from './ast.js'

export const enum TokenKind {
  // Structural keywords
  SMRITI = 'smriti', SUTRA = 'sutra',
  PAKSHA = 'paksha', BHUMIKA = 'bhumika', ADHIKARA = 'adhikara',
  PRAMANA = 'pramana', ADHIPATI = 'adhipati', AAVARTANA = 'aavartana',
  STARA = 'stara', AVADHI = 'avadhi', PRABHAAVA = 'prabhaava',
  STHALA = 'sthala', KSHETRA = 'kshetra',
  SANGAMA = 'sangama', LAGNA = 'lagna', YUJA = 'yuja',

  // Flow keywords
  GHATANA = 'ghatana', VRTTI = 'vrtti', HETU = 'hetu',
  PRAVAH = 'pravah', PADA = 'pada',
  KARTA = 'karta', KAARYA = 'kaarya',
  AAGAMA = 'aagama', NIRGAMA = 'nirgama',
  SAMAYA = 'samaya', KHANDA = 'khanda',
  PRAVRITTI = 'pravritti', PRATIVRITTI = 'prativritti',
  VIPARYAYA = 'viparyaya',
  KALAATIGATA = 'kalaatigata',
  SVASTI = 'svasti', ANAAPTA = 'anaapta',
  VIBHAGA = 'vibhaga', NIYAMA = 'niyama',
  ANUBHAGA = 'anubhaga', ANUGAMA = 'anugama',
  AAVAHA = 'aavaha',

  // Data keywords
  VARNA = 'varna', STHITI = 'sthiti',

  // Type keywords
  SANKHYA = 'sankhya', BHINNAANKA = 'bhinnaanka', DASHAAMSHA = 'dashaamsha',
  VAKYA = 'vakya', TITHI = 'tithi', ANTARA = 'antara',
  TARKA = 'tarka', PATRA = 'patra', KRAMA = 'krama', KOSA = 'kosa',
  VIKALPA = 'vikalpa',

  // tarka values
  SATYA = 'satya', ASATYA = 'asatya', AVYAKTA = 'avyakta',

  // stara values
  PUBLIC = 'public', RESTRICTED = 'restricted', PRIVATE = 'private',

  // Meta-notation (Pāṇinian)
  ITI = 'iti',

  // Literals
  IDENTIFIER = 'identifier',
  STRING = 'string',
  NUMBER = 'number',
  DATE = 'date',
  VERSION = 'version',

  // Punctuation
  LBRACE = '{', RBRACE = '}',
  LPAREN = '(', RPAREN = ')',
  LBRACKET = '[', RBRACKET = ']',
  COLON = ':', COMMA = ',',
  DOT = '.',
  ARROW = '→',

  // Expression operators
  EQEQ = '==', NEQ = '!=',
  LT = '<',    GT = '>',
  LTE = '<=',  GTE = '>=',
  AND = '&&',  OR = '||',
  BANG = '!',

  EOF = 'eof',
}

export interface Token {
  kind: TokenKind
  value: string
  pos: Pos
}

// All Sanskrit keywords the lexer recognises.
// IAST Latin form is canonical — ICU normalization maps other scripts here.
const KEYWORDS: Record<string, TokenKind> = {
  smriti: TokenKind.SMRITI,       sutra: TokenKind.SUTRA,
  paksha: TokenKind.PAKSHA,       bhumika: TokenKind.BHUMIKA,
  adhikara: TokenKind.ADHIKARA,   pramana: TokenKind.PRAMANA,
  adhipati: TokenKind.ADHIPATI,   aavartana: TokenKind.AAVARTANA,
  stara: TokenKind.STARA,         avadhi: TokenKind.AVADHI,
  prabhaava: TokenKind.PRABHAAVA, sthala: TokenKind.STHALA,
  kshetra: TokenKind.KSHETRA,     sangama: TokenKind.SANGAMA,
  lagna: TokenKind.LAGNA,         yuja: TokenKind.YUJA,
  ghatana: TokenKind.GHATANA,     vrtti: TokenKind.VRTTI,
  hetu: TokenKind.HETU,           pravah: TokenKind.PRAVAH,
  pada: TokenKind.PADA,           karta: TokenKind.KARTA,
  kaarya: TokenKind.KAARYA,       aagama: TokenKind.AAGAMA,
  nirgama: TokenKind.NIRGAMA,     samaya: TokenKind.SAMAYA,
  khanda: TokenKind.KHANDA,       pravritti: TokenKind.PRAVRITTI,
  prativritti: TokenKind.PRATIVRITTI,
  viparyaya: TokenKind.VIPARYAYA,
  kalaatigata: TokenKind.KALAATIGATA,
  svasti: TokenKind.SVASTI,       anaapta: TokenKind.ANAAPTA,
  vibhaga: TokenKind.VIBHAGA,     niyama: TokenKind.NIYAMA,
  anubhaga: TokenKind.ANUBHAGA,   anugama: TokenKind.ANUGAMA,
  aavaha: TokenKind.AAVAHA,       varna: TokenKind.VARNA,
  sthiti: TokenKind.STHITI,       sankhya: TokenKind.SANKHYA,
  bhinnaanka: TokenKind.BHINNAANKA, dashaamsha: TokenKind.DASHAAMSHA,
  vakya: TokenKind.VAKYA,         tithi: TokenKind.TITHI,
  antara: TokenKind.ANTARA,       tarka: TokenKind.TARKA,
  patra: TokenKind.PATRA,         krama: TokenKind.KRAMA,
  kosa: TokenKind.KOSA,           vikalpa: TokenKind.VIKALPA,
  satya: TokenKind.SATYA,         asatya: TokenKind.ASATYA,
  avyakta: TokenKind.AVYAKTA,     public: TokenKind.PUBLIC,
  restricted: TokenKind.RESTRICTED, private: TokenKind.PRIVATE,
  iti: TokenKind.ITI,
}

const PUNCTUATION: Record<string, TokenKind> = {
  '{': TokenKind.LBRACE,   '}': TokenKind.RBRACE,
  '(': TokenKind.LPAREN,   ')': TokenKind.RPAREN,
  '[': TokenKind.LBRACKET, ']': TokenKind.RBRACKET,
  ':': TokenKind.COLON,    ',': TokenKind.COMMA,
  '.': TokenKind.DOT,
  '→': TokenKind.ARROW,
}

export class LexError extends Error {
  constructor(message: string, public pos: Pos) {
    super(`[${pos.line}:${pos.col}] ${message}`)
  }
}

export function lex(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  let lineStart = 0

  const pos = (): Pos => ({ line, col: i - lineStart + 1 })

  const peek = (offset = 0) => source[i + offset]
  const advance = () => source[i++]

  while (i < source.length) {
    const ch = source[i]

    // Newline
    if (ch === '\n') { line++; lineStart = ++i; continue }

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue }

    // Comment
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }

    // Arrow ASCII fallback: ->
    if (ch === '-' && peek(1) === '>') {
      tokens.push({ kind: TokenKind.ARROW, value: '→', pos: pos() })
      i += 2; continue
    }

    // Multi-character expression operators — checked before single-char punctuation
    if (ch === '=' && peek(1) === '=') { tokens.push({ kind: TokenKind.EQEQ, value: '==', pos: pos() }); i += 2; continue }
    if (ch === '!' && peek(1) === '=') { tokens.push({ kind: TokenKind.NEQ,  value: '!=', pos: pos() }); i += 2; continue }
    if (ch === '<' && peek(1) === '=') { tokens.push({ kind: TokenKind.LTE,  value: '<=', pos: pos() }); i += 2; continue }
    if (ch === '>' && peek(1) === '=') { tokens.push({ kind: TokenKind.GTE,  value: '>=', pos: pos() }); i += 2; continue }
    if (ch === '&' && peek(1) === '&') { tokens.push({ kind: TokenKind.AND,  value: '&&', pos: pos() }); i += 2; continue }
    if (ch === '|' && peek(1) === '|') { tokens.push({ kind: TokenKind.OR,   value: '||', pos: pos() }); i += 2; continue }
    // Single-char expression operators
    if (ch === '<') { tokens.push({ kind: TokenKind.LT,   value: '<',  pos: pos() }); i++; continue }
    if (ch === '>') { tokens.push({ kind: TokenKind.GT,   value: '>',  pos: pos() }); i++; continue }
    if (ch === '!') { tokens.push({ kind: TokenKind.BANG, value: '!',  pos: pos() }); i++; continue }

    // Punctuation (includes Unicode arrow →)
    if (PUNCTUATION[ch]) {
      tokens.push({ kind: PUNCTUATION[ch], value: ch, pos: pos() })
      i++; continue
    }

    // String literal
    if (ch === '"') {
      const start = pos()
      i++ // consume opening quote
      let value = ''
      while (i < source.length && source[i] !== '"') {
        if (source[i] === '\n') throw new LexError('Unterminated string', start)
        value += advance()
      }
      if (i >= source.length) throw new LexError('Unterminated string', start)
      i++ // consume closing quote
      tokens.push({ kind: TokenKind.STRING, value, pos: start })
      continue
    }

    // Number, version, or date — all start with a digit
    if (ch >= '0' && ch <= '9') {
      const start = pos()
      let value = ''
      while (i < source.length && (source[i] >= '0' && source[i] <= '9')) value += advance()

      // Version: digits.digits.digits
      if (source[i] === '.' && source[i + 1] >= '0' && source[i + 1] <= '9') {
        value += advance() // first dot
        while (i < source.length && (source[i] >= '0' && source[i] <= '9')) value += advance()
        if (source[i] === '.' && source[i + 1] >= '0' && source[i + 1] <= '9') {
          value += advance() // second dot
          while (i < source.length && (source[i] >= '0' && source[i] <= '9')) value += advance()
          tokens.push({ kind: TokenKind.VERSION, value, pos: start })
          continue
        }
        tokens.push({ kind: TokenKind.NUMBER, value, pos: start })
        continue
      }

      // Date: digits-digits-digits
      if (source[i] === '-' && value.length === 4) {
        const saved = i
        let dateVal = value
        dateVal += advance() // -
        while (i < source.length && source[i] >= '0' && source[i] <= '9') dateVal += advance()
        if (source[i] === '-') {
          dateVal += advance()
          while (i < source.length && source[i] >= '0' && source[i] <= '9') dateVal += advance()
          tokens.push({ kind: TokenKind.DATE, value: dateVal, pos: start })
          continue
        }
        i = saved // not a date, restore position
      }

      tokens.push({ kind: TokenKind.NUMBER, value, pos: start })
      continue
    }

    // Identifier or keyword
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      const start = pos()
      let value = ''
      while (i < source.length) {
        const c = source[i]
        if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
            (c >= '0' && c <= '9') || c === '_' || c === '-') {
          value += advance()
        } else break
      }
      const kind = KEYWORDS[value] ?? TokenKind.IDENTIFIER
      tokens.push({ kind, value, pos: start })
      continue
    }

    throw new LexError(`Unexpected character '${ch}'`, pos())
  }

  tokens.push({ kind: TokenKind.EOF, value: '', pos: pos() })
  return tokens
}
