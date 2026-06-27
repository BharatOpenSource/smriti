import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toSvg } from '../src/backends/svg.js'
import { LATIN_LABELS, DEVANAGARI_LABELS, labelsFor } from '../src/scripts.js'

function svg(src: string, script?: 'latin' | 'devanagari'): string {
  const file = typecheck(parse(src))
  const decl = file.decls[0]
  if (decl.kind !== 'smriti') throw new Error('expected smriti')
  return toSvg(decl, script ? { script } : {})
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
    // pill text: "◇  branch: result"
    expect(out).toContain('branch:')
    expect(out).toContain('result')
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

// ─── Script / Devanagari rendering ───────────────────────────────────────────

const STEP_WITH_META = `
smriti test {
  paksha agent { bhumika: officer }
  pravah {
    pada prepare { nirgama: doc-id (vakya) }
    pada verify {
      karta: agent
      aagama: doc-id (vakya)
      nirgama: result (tarka)
      samaya: 2 antara
      apavaada → escalate
      samapti → escalate
    }
    pada escalate { }
    svasti
  }
}
`

describe('scripts — label tables', () => {
  it('labelsFor latin returns LATIN_LABELS', () => {
    expect(labelsFor('latin')).toBe(LATIN_LABELS)
  })

  it('labelsFor devanagari returns DEVANAGARI_LABELS', () => {
    expect(labelsFor('devanagari')).toBe(DEVANAGARI_LABELS)
  })

  it('LATIN_LABELS.completed contains Completed', () => {
    expect(LATIN_LABELS.completed).toContain('Completed')
  })

  it('DEVANAGARI_LABELS.completed contains स्वस्ति', () => {
    expect(DEVANAGARI_LABELS.completed).toContain('स्वस्ति')
  })

  it('DEVANAGARI_LABELS.rejected contains अनाप्त', () => {
    expect(DEVANAGARI_LABELS.rejected).toContain('अनाप्त')
  })

  it('DEVANAGARI_LABELS.fontFamily includes Noto Sans Devanagari', () => {
    expect(DEVANAGARI_LABELS.fontFamily).toContain('Noto Sans Devanagari')
  })

  it('DEVANAGARI_LABELS.valueOffset is wider than LATIN_LABELS.valueOffset', () => {
    expect(DEVANAGARI_LABELS.valueOffset).toBeGreaterThan(LATIN_LABELS.valueOffset)
  })
})

describe('svg backend — devanagari script', () => {
  it('default (no option) uses Latin labels', () => {
    const out = svg(STEP_WITH_META)
    expect(out).toContain('Actor:')
    expect(out).toContain('In:')
    expect(out).toContain('Out:')
    expect(out).toContain('SLA:')
    expect(out).toContain('⚠ fail →')
    expect(out).toContain('⏱ timeout →')
    expect(out).toContain('Completed')
  })

  it('latin option produces same output as default', () => {
    const def = svg(STEP_WITH_META)
    const lat = svg(STEP_WITH_META, 'latin')
    expect(lat).toBe(def)
  })

  it('devanagari option uses Devanagari labels for actor', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('कर्ता:')
    expect(out).not.toContain('Actor:')
  })

  it('devanagari option uses Devanagari labels for aagama/nirgama', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('आगम:')
    expect(out).toContain('निर्गम:')
    expect(out).not.toContain('>In:<')
    expect(out).not.toContain('>Out:<')
  })

  it('devanagari option uses Devanagari label for samaya (SLA)', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('समय:')
    expect(out).not.toContain('>SLA:<')
  })

  it('devanagari option uses अपवाद for fail route', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('अपवाद')
    expect(out).not.toContain('fail →')
  })

  it('devanagari option uses समाप्ति for timeout route', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('समाप्ति')
    expect(out).not.toContain('timeout →')
  })

  it('devanagari terminal: svasti renders as स्वस्ति', () => {
    const src = `smriti t { pravah { pada s { } svasti } }`
    const out = svg(src, 'devanagari')
    expect(out).toContain('स्वस्ति')
    expect(out).not.toContain('Completed')
  })

  it('devanagari terminal: anaapta renders as अनाप्त', () => {
    const src = `smriti t { pravah { pada s { } anaapta } }`
    const out = svg(src, 'devanagari')
    expect(out).toContain('अनाप्त')
    expect(out).not.toContain('Rejected')
  })

  it('devanagari vibhaga branch label uses विभाग', () => {
    const src = `
smriti t { pravah {
  pada s { nirgama: ok (tarka) }
  vibhaga ok { niyama satya → svasti niyama asatya → anaapta niyama avyakta → anaapta }
  svasti
  anaapta
} }`
    const out = svg(src, 'devanagari')
    expect(out).toContain('विभाग:')
    expect(out).not.toContain('branch:')
  })

  it('devanagari font-family includes Devanagari font names', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('Noto Sans Devanagari')
    expect(out).not.toContain('Segoe UI')
  })

  it('latin font-family uses Segoe UI stack', () => {
    const out = svg(STEP_WITH_META, 'latin')
    expect(out).toContain('Segoe UI')
  })

  it('devanagari output is still valid SVG', () => {
    const out = svg(STEP_WITH_META, 'devanagari')
    expect(out).toContain('<svg ')
    expect(out).toContain('</svg>')
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
})
