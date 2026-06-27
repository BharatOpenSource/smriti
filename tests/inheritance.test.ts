import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports } from '../src/resolver.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function check(src: string) {
  const ast = parse(src)
  return typecheck(ast, resolveImports(ast, '/test/file.smr'))
}

function ok(src: string) {
  expect(() => check(src)).not.toThrow()
}

function fails(src: string, pattern: RegExp) {
  expect(() => check(src)).toThrow(pattern)
}

// ─── Parsing: anuvṛtti keyword ────────────────────────────────────────────────

describe('anuvṛtti parsing', () => {
  it('parses sutra with anuvṛtti parent', () => {
    const src = `
sutra base-kyc {
  aagama: name (vakya), dob (vakya)
  pravah {
    pada verify { kaarya: "verify" aagama: name (vakya) nirgama: verified (tarka) }
    svasti
  }
  nirgama: verified (tarka)
}
sutra enhanced-kyc anuvrtti base-kyc {
  aagama: pan (vakya)
  pravah {
    pada scan-pan { kaarya: "scan PAN" aagama: pan (vakya) }
    svasti
  }
}
`
    const ast = parse(src)
    const sutra = ast.decls[1]
    if (sutra.kind !== 'sutra') throw new Error('expected sutra')
    expect(sutra.parent).toBeDefined()
    expect(typeof sutra.parent).toBe('string')
    expect(sutra.parent).toBe('base-kyc')
  })

  it('parses sutra without anuvṛtti (no parent)', () => {
    const src = `
sutra standalone {
  pravah {
    pada do-work { kaarya: "work" }
    svasti
  }
}
`
    const ast = parse(src)
    const sutra = ast.decls[0]
    if (sutra.kind !== 'sutra') throw new Error('expected sutra')
    expect(sutra.parent).toBeUndefined()
  })
})

// ─── Parsing: aadesha keyword ─────────────────────────────────────────────────

describe('aadesha parsing', () => {
  it('parses aadesha step inside sutra flow', () => {
    const src = `
sutra base {
  pravah {
    pada verify { kaarya: "verify" nirgama: ok (tarka) }
    vibhaga ok { niyama satya → svasti niyama asatya → anaapta niyama avyakta → anaapta }
    svasti
    anaapta
  }
}
sutra extended anuvrtti base {
  pravah {
    aadesha verify {
      kaarya: "verify with extra step"
      nirgama: ok (tarka)
    }
    svasti
  }
}
`
    const ast = parse(src)
    const ext = ast.decls[1]
    if (ext.kind !== 'sutra') throw new Error('expected sutra')
    const aadesha = ext.flow.items[0]
    expect(aadesha.kind).toBe('aadesha')
    if (aadesha.kind !== 'aadesha') return
    expect(aadesha.target).toBe('verify')
    expect(aadesha.pada.kaarya).toBe('verify with extra step')
  })

  it('aadesha step parsed without itiName', () => {
    const src = `
sutra base {
  pravah {
    pada step-a { kaarya: "a" }
    svasti
  }
}
sutra child anuvrtti base {
  pravah {
    aadesha step-a { kaarya: "replaced" }
    svasti
  }
}
`
    const ast = parse(src)
    const child = ast.decls[1]
    if (child.kind !== 'sutra') return
    const aadesha = child.flow.items[0]
    if (aadesha.kind !== 'aadesha') return
    expect(aadesha.pada.itiName).toBeUndefined()
  })
})

// ─── Typechecking: aadesha ────────────────────────────────────────────────────

describe('aadesha typechecking', () => {
  it('accepts valid aadesha with correct nirgama', () => {
    ok(`
sutra base {
  pravah {
    pada compute { kaarya: "compute" nirgama: result (sankhya) }
    vibhaga result {
      niyama satya → svasti
      niyama asatya → anaapta
      niyama avyakta → anaapta
    }
    svasti
    anaapta
  }
}
sutra overridden anuvrtti base {
  pravah {
    aadesha compute {
      kaarya: "compute v2"
      nirgama: result (sankhya)
    }
    svasti
  }
}
`)
  })
})

// ─── Typechecking: child sutra with aagama extension ─────────────────────────

describe('child sutra aagama', () => {
  it('accepts child sutra declaring additional aagama', () => {
    ok(`
sutra base {
  aagama: name (vakya)
  pravah {
    pada a { kaarya: "a" aagama: name (vakya) }
    svasti
  }
}
sutra child anuvrtti base {
  aagama: extra (vakya)
  pravah {
    pada b { kaarya: "b" aagama: extra (vakya) }
    svasti
  }
}
`)
  })
})
