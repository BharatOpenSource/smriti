import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import type { SmritiDecl, AnubhagaDecl } from '../src/ast.js'

function check(src: string) { return typecheck(parse(src)) }
function flow(src: string) { return (check(src).decls[0] as SmritiDecl).flow! }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_PARALLEL = `
smriti test {
  pravah {
    pada prepare {
      nirgama: doc-id (vakya)
    }
    anubhaga {
      pada kyc-check {
        aagama: doc-id (vakya)
        nirgama: kyc-result (tarka)
      }
    }, {
      pada address-verify {
        aagama: doc-id (vakya)
        nirgama: address-ok (tarka)
      }
    }
    anugama kyc-check address-verify
    svasti
  }
}
`

const THREE_TRACKS = `
smriti test {
  pravah {
    anubhaga {
      pada track-a { nirgama: a (tarka) }
    }, {
      pada track-b { nirgama: b (tarka) }
    }, {
      pada track-c { nirgama: c (tarka) }
    }
    anugama track-a track-b track-c
    svasti
  }
}
`

// ─── Parser ───────────────────────────────────────────────────────────────────

describe('parallel — parser', () => {
  it('parses anubhaga with two tracks', () => {
    const items = flow(VALID_PARALLEL).items
    const split = items.find(i => i.kind === 'anubhaga') as AnubhagaDecl
    expect(split.tracks).toHaveLength(2)
  })

  it('each track contains its own flow items', () => {
    const items = flow(VALID_PARALLEL).items
    const split = items.find(i => i.kind === 'anubhaga') as AnubhagaDecl
    expect(split.tracks[0][0]).toMatchObject({ kind: 'pada', name: 'kyc-check' })
    expect(split.tracks[1][0]).toMatchObject({ kind: 'pada', name: 'address-verify' })
  })

  it('parses anugama with multiple step names', () => {
    const items = flow(VALID_PARALLEL).items
    const join = items.find(i => i.kind === 'anugama') as { kind: 'anugama'; tracks: string[] }
    expect(join.tracks).toEqual(['kyc-check', 'address-verify'])
  })

  it('parses three-track anubhaga', () => {
    const items = flow(THREE_TRACKS).items
    const split = items.find(i => i.kind === 'anubhaga') as AnubhagaDecl
    expect(split.tracks).toHaveLength(3)
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────────

describe('parallel — typechecker', () => {
  it('accepts valid parallel split and join', () => {
    expect(() => check(VALID_PARALLEL)).not.toThrow()
  })

  it('accepts three-track split with full join', () => {
    expect(() => check(THREE_TRACKS)).not.toThrow()
  })

  it('accepts anugama referencing a subset of tracks', () => {
    const src = `
smriti t { pravah {
  anubhaga {
    pada a { nirgama: x (tarka) }
  }, {
    pada b { nirgama: y (tarka) }
  }
  anugama a
  svasti
} }
`
    expect(() => check(src)).not.toThrow()
  })

  it('rejects anugama name that does not exist in any parallel track', () => {
    const src = `
smriti t { pravah {
  anubhaga {
    pada real-step { }
  }, {
    pada other-step { }
  }
  anugama ghost-step
  svasti
} }
`
    expect(() => check(src)).toThrow(/anugama references 'ghost-step' which is not a step/)
  })

  it('error message mentions anubhaga block', () => {
    const src = `
smriti t { pravah {
  anubhaga { pada a { } }, { pada b { } }
  anugama typo
  svasti
} }
`
    expect(() => check(src)).toThrow(/anubhaga/)
  })

  it('inner track steps are valid targets for viparyaya in outer flow', () => {
    // anubhaga steps are added to outer stepNames — can be referenced by apavaada too
    const src = `
smriti t { pravah {
  anubhaga {
    pada inner { }
  }, {
    pada other { }
  }
  anugama inner other
  pada cleanup { apavaada → inner }
  svasti
} }
`
    expect(() => check(src)).not.toThrow()
  })

  it('typecheck recurses into anubhaga tracks — catches errors inside tracks', () => {
    // karta validation fires when participants are declared; the unknown karta should fail
    const src = `
smriti t {
  paksha real-actor { bhumika: officer }
  pravah {
    anubhaga {
      pada bad { karta: ghost-actor }
    }, {
      pada good { }
    }
    anugama bad good
    svasti
  }
}
`
    expect(() => check(src)).toThrow(/karta/)
  })
})
