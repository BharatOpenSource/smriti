import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toYaml } from '../src/backends/yaml.js'

function emit(src: string): string {
  const file = typecheck(parse(src))
  const decl = file.decls[0]
  if (decl.kind !== 'smriti') throw new Error('expected smriti')
  return toYaml(decl)
}

const PASSPORT = `
smriti passport-renewal {
  adhipati: "Ministry of External Affairs"
  aavartana: 1.0.0
  stara: public
  avadhi: 30 antara
  aagama: old-passport (patra)

  paksha applicant {
    bhumika: citizen
    adhikara: submit
    pramana: "Passport Rules 1980, Rule 3"
  }

  paksha passport-office {
    bhumika: processing-authority
    adhikara: approve, reject
    pramana: "Passport Act 1967, Section 5"
  }

  pravah {
    pada submit {
      karta: applicant
      kaarya: "Submit passport renewal application"
      aagama: old-passport (patra)
      nirgama: application-id (vakya)
      samaya: 7 antara
    }

    pada verify {
      karta: passport-office
      kaarya: "Verify submitted documents"
      aagama: application-id (vakya)
      nirgama: verified (tarka)
      samaya: 14 antara
    }

    vibhaga verified {
      niyama satya    → svasti
      niyama asatya   → anaapta
      niyama avyakta  → anaapta
    }

    svasti
    anaapta
  }
}
`

describe('yaml backend', () => {
  it('emits a process block', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('process:')
    expect(out).toContain('id: passport-renewal')
    expect(out).toContain('name: Passport Renewal')
    expect(out).toContain('version: "1.0.0"')
  })

  it('emits metadata fields', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('visibility: public')
    expect(out).toContain('change_lock_days: 30')
    expect(out).toContain('owner:')
    expect(out).toContain('name: Ministry of External Affairs')
  })

  it('emits parties from paksha declarations', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('parties:')
    expect(out).toContain('id: applicant')
    expect(out).toContain('role: Citizen')
    expect(out).toContain('id: passport-office')
  })

  it('emits rights from adhikara declarations', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('rights:')
    expect(out).toContain('party: applicant')
    expect(out).toContain('right: Submit')
  })

  it('emits authority.law from pramana (pravaaha requires a backing citation)', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('authority:')
    expect(out).toContain('law: Passport Act 1967, Section 5')
  })

  it('throws when a right has no pramana to back it', () => {
    const src = `
      smriti t {
        paksha applicant {
          bhumika: citizen
          adhikara: submit
        }
        pravah { svasti }
      }
    `
    expect(() => emit(src)).toThrow(/adhikara 'submit' with no pramana/)
  })

  it('emits steps from pada declarations', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('steps:')
    expect(out).toContain('id: submit')
    expect(out).toContain('name: Submit')
    expect(out).toContain('actor: applicant')
    expect(out).toContain('action: Submit passport renewal application')
  })

  it('emits inputs and outputs as field name arrays', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('inputs: [old-passport]')
    expect(out).toContain('outputs: [application-id]')
  })

  it('emits sla from samaya', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('sla: 7 antara')
  })

  it('merges vibhaga conditions into the step that produces the branched output', () => {
    const out = emit(PASSPORT)
    // The verify step produces 'verified', and vibhaga branches on 'verified'
    // So conditions should appear under the verify step
    expect(out).toContain('conditions:')
    expect(out).toContain('if: satya')
    expect(out).toContain('next: svasti')
    expect(out).toContain('if: asatya')
    expect(out).toContain('next: anaapta')
  })

  it('emits terminal steps for svasti and anaapta', () => {
    const out = emit(PASSPORT)
    expect(out).toContain('id: svasti')
    expect(out).toContain('id: anaapta')
    expect(out).toContain('terminal: true')
  })

  it('does not emit an outcome field on terminal steps (not part of pravaaha\'s schema)', () => {
    const out = emit(PASSPORT)
    expect(out).not.toContain('outcome:')
  })

  it('makes an unrouted step\'s implicit fall-through explicit as next', () => {
    // pravaaha requires every step to declare next/conditions/loop_back/terminal — Smriti's
    // own executor treats an unrouted pada as "fall through to the next flow item" (cursor+1)
    // with no explicit field needed. The YAML backend must make that explicit.
    const src = `
      smriti t {
        pravah {
          pada first { nirgama: x (tarka) }
          pada second { nirgama: y (tarka) }
          svasti
        }
      }
    `
    const out = emit(src)
    expect(out).toContain('id: first')
    expect(out).toContain('next: second')
  })
})
