import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'

const MINIMAL = `
smriti passport-renewal {
  adhipati: "Ministry of External Affairs"
  aavartana: 1.0.0
  stara: public

  paksha applicant {
    bhumika: citizen
    adhikara: submit
  }

  ghatana {
    vrtti: "Applicant submits renewal request"
  }

  pravah {
    pada submit {
      karta: applicant
      kaarya: "Submit passport renewal application"
      aagama: old-passport (patra)
      nirgama: application-id (vakya)
      samaya: 30 antara
    }

    vibhaga application-id {
      niyama satya   → verify
      niyama avyakta → anaapta
    }

    pada verify {
      karta: passport-office
      kaarya: "Verify documents"
      nirgama: result (tarka)
    }

    vibhaga result {
      niyama satya  → svasti
      niyama asatya → anaapta
      niyama avyakta → request-info
    }

    pada request-info {
      kaarya: "Request additional information"
      prativritti: submit
    }
  }
}
`

describe('parser', () => {
  it('parses a minimal smriti file', () => {
    const ast = parse(MINIMAL)
    expect(ast.kind).toBe('file')
    expect(ast.decls).toHaveLength(1)
    const smr = ast.decls[0]
    expect(smr.kind).toBe('smriti')
    if (smr.kind !== 'smriti') return
    expect(smr.name).toBe('passport-renewal')
  })

  it('parses metadata correctly', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.metadata.adhipati).toBe('Ministry of External Affairs')
    expect(smr.metadata.aavartana).toBe('1.0.0')
    expect(smr.metadata.stara).toBe('public')
  })

  it('parses participants', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.participants).toHaveLength(1)
    expect(smr.participants[0].name).toBe('applicant')
    expect(smr.participants[0].bhumika).toBe('citizen')
    expect(smr.participants[0].adhikara).toEqual(['submit'])
  })

  it('parses trigger', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    expect(smr.trigger?.kind).toBe('ghatana')
    expect(smr.trigger?.items[0].kind).toBe('vrtti')
  })

  it('parses flow steps', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    const items = smr.flow.items
    expect(items[0].kind).toBe('pada')
    if (items[0].kind !== 'pada') return
    expect(items[0].name).toBe('submit')
    expect(items[0].karta).toBe('applicant')
    expect(items[0].aagama[0].name).toBe('old-passport')
    expect(items[0].aagama[0].type.kind).toBe('patra')
    expect(items[0].samaya?.value).toBe(30)
  })

  it('parses vibhaga with tarka values', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    const vibhaga = smr.flow.items[1]
    expect(vibhaga.kind).toBe('vibhaga')
    if (vibhaga.kind !== 'vibhaga') return
    expect(vibhaga.clauses[0].condition).toMatchObject({ kind: 'tarka-literal', value: 'satya' })
    expect(vibhaga.clauses[1].target).toBe('anaapta')
  })

  it('parses prativritti (loop back)', () => {
    const ast = parse(MINIMAL)
    const smr = ast.decls[0]
    if (smr.kind !== 'smriti') return
    const requestInfo = smr.flow.items.find(i => i.kind === 'pada' && i.name === 'request-info')
    expect(requestInfo?.kind).toBe('pada')
    if (requestInfo?.kind !== 'pada') return
    expect(requestInfo.routing?.kind).toBe('prativritti')
    expect((requestInfo.routing as any)?.target).toBe('submit')
  })

  it('parses a declaration-only smriti with no pravah', () => {
    const src = `
smriti gov-india-participants {
  adhipati: "Government of India"
  paksha citizen      { bhumika: individual  adhikara: apply }
  paksha mea          { bhumika: ministry    adhikara: approve }
  paksha uidai        { bhumika: authority   adhikara: verify }
}
`
    const ast = parse(src)
    expect(ast.decls.length).toBe(1)
    const decl = ast.decls[0]
    expect(decl.kind).toBe('smriti')
    if (decl.kind !== 'smriti') return
    expect(decl.flow).toBeUndefined()
    expect(decl.participants.length).toBe(3)
    expect(decl.participants[0].name).toBe('citizen')
    expect(decl.participants[2].name).toBe('uidai')
  })

  it('throws a clear error on bad syntax', () => {
    expect(() => parse('smriti { }')).toThrow(/Expected 'identifier'/)
  })
})
