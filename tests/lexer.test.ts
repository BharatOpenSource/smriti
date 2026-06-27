import { describe, it, expect } from 'vitest'
import { lex, TokenKind } from '../src/lexer.js'

describe('lexer', () => {
  it('tokenises keywords', () => {
    const tokens = lex('smriti sutra paksha pravah pada')
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.SMRITI, TokenKind.SUTRA, TokenKind.PAKSHA,
      TokenKind.PRAVAH, TokenKind.PADA, TokenKind.EOF,
    ])
  })

  it('tokenises tarka values', () => {
    const tokens = lex('satya asatya avyakta')
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.SATYA, TokenKind.ASATYA, TokenKind.AVYAKTA, TokenKind.EOF,
    ])
  })

  it('tokenises string literals', () => {
    const tokens = lex('"Ministry of External Affairs"')
    expect(tokens[0].kind).toBe(TokenKind.STRING)
    expect(tokens[0].value).toBe('Ministry of External Affairs')
  })

  it('tokenises version literals', () => {
    const tokens = lex('1.0.0')
    expect(tokens[0].kind).toBe(TokenKind.VERSION)
    expect(tokens[0].value).toBe('1.0.0')
  })

  it('tokenises date literals', () => {
    const tokens = lex('2026-01-01')
    expect(tokens[0].kind).toBe(TokenKind.DATE)
    expect(tokens[0].value).toBe('2026-01-01')
  })

  it('tokenises punctuation including arrow', () => {
    const tokens = lex('{ } ( ) : , →')
    expect(tokens.map(t => t.kind)).toEqual([
      TokenKind.LBRACE, TokenKind.RBRACE,
      TokenKind.LPAREN, TokenKind.RPAREN,
      TokenKind.COLON, TokenKind.COMMA,
      TokenKind.ARROW, TokenKind.EOF,
    ])
  })

  it('accepts ASCII arrow fallback ->', () => {
    const tokens = lex('->')
    expect(tokens[0].kind).toBe(TokenKind.ARROW)
  })

  it('skips comments', () => {
    const tokens = lex('# this is a comment\nsmriti')
    expect(tokens[0].kind).toBe(TokenKind.SMRITI)
  })

  it('tracks line and column positions', () => {
    const tokens = lex('smriti\npada')
    expect(tokens[0].pos).toEqual({ line: 1, col: 1 })
    expect(tokens[1].pos).toEqual({ line: 2, col: 1 })
  })

  it('throws on unexpected character', () => {
    expect(() => lex('@')).toThrow("Unexpected character '@'")
  })
})
