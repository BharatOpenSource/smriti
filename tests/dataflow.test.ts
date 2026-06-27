import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'

function check(src: string) { return typecheck(parse(src)) }
function fail(src: string, msg: RegExp) {
  expect(() => check(src)).toThrow(msg)
}
function pass(src: string) {
  expect(() => check(src)).not.toThrow()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const flow = (inner: string, smritiHeader = '') => `
smriti test {
  ${smritiHeader}
  pravah { ${inner} }
}
`

// ─── aagama / nirgama connectivity ───────────────────────────────────────────

describe('data flow — aagama/nirgama connectivity', () => {
  it('accepts aagama that was produced by a previous step', () => {
    pass(flow(`
      pada a { nirgama: doc (patra) }
      pada b { aagama: doc (patra) }
      svasti
    `))
  })

  it('rejects aagama field not produced by any step', () => {
    fail(flow(`
      pada a { nirgama: result (tarka) }
      pada b { aagama: ghost (tarka) }
      svasti
    `), /aagama 'ghost' is not produced/)
  })

  it('lists available fields in the error message', () => {
    fail(flow(`
      pada a { nirgama: score (sankhya), status (vakya) }
      pada b { aagama: missing (tarka) }
      svasti
    `), /available: score, status/)
  })

  it('rejects aagama type mismatch: field produced as tarka but consumed as sankhya', () => {
    fail(flow(`
      pada a { nirgama: result (tarka) }
      pada b { aagama: result (sankhya) }
      svasti
    `), /aagama 'result': declared as sankhya but produced as tarka/)
  })

  it('accepts aagama with matching krama type', () => {
    pass(flow(`
      pada a { nirgama: items (krama[vakya]) }
      pada b { aagama: items (krama[vakya]) }
      svasti
    `))
  })

  it('rejects aagama krama type mismatch', () => {
    fail(flow(`
      pada a { nirgama: items (krama[vakya]) }
      pada b { aagama: items (krama[sankhya]) }
      svasti
    `), /declared as krama\[sankhya\] but produced as krama\[vakya\]/)
  })

  it('allows flows with no typed fields — no data flow errors', () => {
    pass(flow(`
      pada a { kaarya: "Do work" }
      svasti
    `))
  })
})

// ─── vibhaga field reference ──────────────────────────────────────────────────

describe('data flow — vibhaga field reference', () => {
  it('accepts vibhaga that branches on a produced field', () => {
    pass(flow(`
      pada a { nirgama: result (tarka) }
      vibhaga result {
        niyama satya    → svasti
        niyama asatya   → anaapta
        niyama avyakta  → anaapta
      }
      svasti
      anaapta
    `))
  })

  it('rejects vibhaga that references an unproduced field', () => {
    fail(flow(`
      pada a { nirgama: result (tarka) }
      vibhaga ghost {
        niyama satya → svasti
        niyama avyakta → anaapta
        niyama asatya → anaapta
      }
      svasti
      anaapta
    `), /vibhaga 'ghost' references field not produced/)
  })

  it('lists available fields in vibhaga error message', () => {
    fail(flow(`
      pada a { nirgama: score (sankhya), status (vakya) }
      vibhaga missing {
        niyama score >= 90 → svasti
        niyama score < 90  → anaapta
      }
      svasti
      anaapta
    `), /available: score, status/)
  })
})

// ─── smriti-level process inputs ─────────────────────────────────────────────

describe('data flow — smriti-level aagama (process inputs)', () => {
  it('allows step to consume smriti-level aagama field', () => {
    pass(`
smriti test {
  aagama: old-passport (patra)
  pravah {
    pada submit {
      aagama: old-passport (patra)
      nirgama: application-id (vakya)
    }
    svasti
  }
}
`)
  })

  it('rejects type mismatch between smriti-level aagama and step aagama', () => {
    fail(`
smriti test {
  aagama: old-passport (patra)
  pravah {
    pada submit {
      aagama: old-passport (vakya)
      nirgama: application-id (vakya)
    }
    svasti
  }
}
`, /aagama 'old-passport': declared as vakya but produced as patra/)
  })
})
