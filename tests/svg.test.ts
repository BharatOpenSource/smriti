import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toSvg } from '../src/backends/svg.js'

function svg(src: string): string {
  const file = typecheck(parse(src))
  const decl = file.decls[0]
  if (decl.kind !== 'smriti') throw new Error('expected smriti')
  return toSvg(decl)
}

const SIMPLE = `
smriti passport-renewal {
  adhipati: "Ministry of External Affairs"
  aavartana: 1.0.0
  stara: public

  paksha applicant { bhumika: citizen }
  paksha passport-office { bhumika: authority }

  pravah {
    pada submit {
      karta: applicant
      kaarya: "Submit documents"
      nirgama: result (tarka)
    }
    vibhaga result {
      niyama satya   → svasti
      niyama asatya  → anaapta
      niyama avyakta → anaapta
    }
    svasti
    anaapta
  }
}
`

describe('svg backend', () => {
  it('returns a valid SVG document', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('<svg ')
    expect(out).toContain('</svg>')
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })

  it('includes the process name in the header', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('passport-renewal')
  })

  it('includes step names', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('submit')
  })

  it('includes vibhaga branch label', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('branch: result')
  })

  it('includes tarka condition values', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('satya')
    expect(out).toContain('asatya')
    expect(out).toContain('avyakta')
  })

  it('includes terminal labels', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('Completed')
    expect(out).toContain('Rejected')
  })

  it('includes arrow markers', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('<marker ')
    expect(out).toContain('url(#arr)')
  })

  it('has a positive numeric height in the svg element', () => {
    const out = svg(SIMPLE)
    const m = out.match(/height="(\d+)"/)
    expect(m).toBeTruthy()
    expect(parseInt(m![1])).toBeGreaterThan(200)
  })

  it('escapes HTML special characters in text content', () => {
    const src = `
smriti test-escaping {
  adhipati: "A & B <org>"
  pravah {
    pada step { karta: actor kaarya: "Check A & B conditions" }
    svasti
  }
}
`
    const out = svg(src)
    expect(out).toContain('&amp;')
    expect(out).toContain('&lt;')
  })

  it('includes metadata subtitle fields', () => {
    const out = svg(SIMPLE)
    expect(out).toContain('Ministry of External Affairs')
    expect(out).toContain('public')
  })
})
