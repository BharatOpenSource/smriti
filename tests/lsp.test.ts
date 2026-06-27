// LSP server unit tests — tests the diagnostic and hover logic directly,
// without spawning the server process over stdio.
import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { lex, TokenKind } from '../src/lexer.js'

// ─── Helpers that mirror the server's validate/hover logic ────────────────────

function collectErrors(source: string): string[] {
  const errors: string[] = []
  try {
    const ast = parse(source)
    try { typecheck(ast) } catch (e) { errors.push(String(e)) }
  } catch (e) {
    errors.push(String(e))
  }
  return errors
}

function findHoverToken(source: string, keyword: string): TokenKind | null {
  const tokens = lex(source)
  const t = tokens.find(t => t.value === keyword)
  return t?.kind ?? null
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('lsp diagnostics', () => {
  it('returns no errors for valid source', () => {
    const src = `
smriti test {
  pravah {
    pada step { karta: actor }
    svasti
  }
}
`
    expect(collectErrors(src)).toHaveLength(0)
  })

  it('reports a lex error for unknown character', () => {
    const errs = collectErrors('smriti @ {}')
    expect(errs.length).toBeGreaterThan(0)
    expect(errs[0]).toMatch(/unexpected|lex|@/i)
  })

  it('reports a parse error for missing brace', () => {
    const errs = collectErrors('smriti test {')
    expect(errs.length).toBeGreaterThan(0)
  })

  it('reports a typecheck error for unknown branch target', () => {
    const errs = collectErrors(`
smriti bad {
  pravah {
    pada step { nirgama: flag (tarka) }
    vibhaga flag {
      niyama satya   → does-not-exist
      niyama asatya  → svasti
      niyama avyakta → anaapta
    }
    svasti
    anaapta
  }
}
`)
    expect(errs.length).toBeGreaterThan(0)
    expect(errs[0]).toMatch(/does-not-exist|target|branch/i)
  })

  it('reports duplicate step names', () => {
    const errs = collectErrors(`
smriti dup {
  pravah {
    pada step { karta: a }
    pada step { karta: b }
    svasti
  }
}
`)
    expect(errs.length).toBeGreaterThan(0)
    expect(errs[0]).toMatch(/step|duplicate|unique/i)
  })
})

describe('lsp hover token detection', () => {
  it('identifies smriti keyword token', () => {
    expect(findHoverToken('smriti test {}', 'smriti')).toBe(TokenKind.SMRITI)
  })

  it('identifies pada keyword token', () => {
    expect(findHoverToken('smriti x { pravah { pada step {} svasti } }', 'pada')).toBe(TokenKind.PADA)
  })

  it('identifies tarka type token', () => {
    expect(findHoverToken('smriti x { pravah { pada s { nirgama: f (tarka) } svasti } }', 'tarka')).toBe(TokenKind.TARKA)
  })

  it('identifies avyakta token', () => {
    const src = 'smriti x { pravah { pada s { nirgama: f (tarka) } vibhaga f { niyama avyakta → svasti } svasti anaapta } }'
    expect(findHoverToken(src, 'avyakta')).toBe(TokenKind.AVYAKTA)
  })

  it('returns null for non-keyword identifiers', () => {
    expect(findHoverToken('smriti my-process {}', 'my-process')).toBe(TokenKind.IDENTIFIER)
  })
})
