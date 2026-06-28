import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { buildKriyaEnv } from '../src/evaluator.js'
import { buildRegistry } from '../src/registry.js'
import { executeSmriti } from '../src/executor.js'
import type { SmritiDecl } from '../src/ast.js'

// Finds the LAST smriti in a file — tests declare child/helper smriti first, parent last.
function setup(src: string, payload: Record<string, unknown> = {}) {
  const file = typecheck(parse(src))
  const env = buildKriyaEnv(file)
  const registry = buildRegistry(file)
  const smritis = file.decls.filter(d => d.kind === 'smriti') as SmritiDecl[]
  const decl = smritis[smritis.length - 1]
  return { file, env, registry, decl,
    run: () => executeSmriti(decl, payload as Record<string, string | number | boolean | null>, env, registry) }
}

// ─── Registry construction ────────────────────────────────────────────────────

describe('buildRegistry', () => {
  it('finds top-level smriti by name', () => {
    const file = typecheck(parse(`smriti my-process { pravah { svasti } }`))
    const reg = buildRegistry(file)
    expect(reg.get('my-process')?.kind).toBe('smriti')
  })

  it('finds sutra by name', () => {
    const file = typecheck(parse(`
sutra kyc-check {
  aagama: pan (vakya)
  pravah { svasti }
  nirgama: ok (tarka)
}
`))
    const reg = buildRegistry(file)
    expect(reg.get('kyc-check')?.kind).toBe('sutra')
  })

  it('returns undefined for unknown names', () => {
    const file = typecheck(parse(`smriti test { pravah { svasti } }`))
    expect(buildRegistry(file).get('not-here')).toBeUndefined()
  })

  it('names() lists all registered entries', () => {
    const file = typecheck(parse(`
smriti parent { pravah { svasti } }
smriti child  { pravah { svasti } }
`))
    const names = buildRegistry(file).names()
    expect(names).toContain('parent')
    expect(names).toContain('child')
  })

  it('register() adds a new entry at runtime', () => {
    const file = typecheck(parse(`smriti test { pravah { svasti } }`))
    const reg = buildRegistry(file)
    const extra = parse(`smriti extra { pravah { svasti } }`).decls[0] as SmritiDecl
    reg.register('extra', extra)
    expect(reg.get('extra')).toBeDefined()
  })
})

// ─── aavaha stub (no registry) ────────────────────────────────────────────────

describe('aavaha without registry', () => {
  it('aavaha logs as skipped when registry not provided', () => {
    const file = typecheck(parse(`
smriti child { pravah { svasti } }
smriti parent {
  pravah {
    aavaha child
    svasti
  }
}
`))
    const env = buildKriyaEnv(file)
    const decl = file.decls.find(d => d.kind === 'smriti' && d.name === 'parent') as SmritiDecl
    const result = executeSmriti(decl, {}, env)
    expect(result.outcome).toBe('svasti')
    expect(result.log.find(l => l.name === 'child')?.status).toBe('skipped')
  })
})

// ─── aavaha dispatch ─────────────────────────────────────────────────────────

describe('aavaha — sub-process invocation', () => {
  it('aavaha executes the named child smriti', () => {
    const { run } = setup(`
smriti child {
  pravah {
    pada verify { nirgama: ok (tarka) }
    svasti
  }
}
smriti parent {
  pravah {
    aavaha child
    svasti
  }
}
`)
    const result = run()
    expect(result.outcome).toBe('svasti')
    expect(result.log.find(l => l.name === 'child')).toBeDefined()
  })

  it('aavaha passes aagama from parent produced to child', () => {
    const { run } = setup(`
smriti child {
  aagama: amount (sankhya)
  pravah {
    pada check {
      khanda: amount > 0
      nirgama: ok (tarka)
    }
    svasti
  }
}
smriti parent {
  aagama: amount (sankhya)
  pravah {
    aavaha child
      aagama: amount (sankhya)
    svasti
  }
}
`, { amount: 500 })
    const result = run()
    expect(result.outcome).toBe('svasti')
    expect(result.log.some(l => l.name === 'check')).toBe(true)
  })

  it('aavaha writes nirgama back to parent produced', () => {
    const { run } = setup(`
smriti validator {
  aagama: amount (sankhya)
  pravah {
    pada compute { nirgama: tax (sankhya) }
    svasti
  }
}
smriti parent {
  aagama: amount (sankhya)
  pravah {
    aavaha validator
      aagama: amount (sankhya)
      nirgama: tax (sankhya)
    svasti
  }
}
`, { amount: 1000 })
    const result = run()
    expect('tax' in result.produced).toBe(true)
  })

  it('child steps appear in parent log', () => {
    const { run } = setup(`
smriti kyc {
  pravah {
    pada verify-pan { nirgama: pan-ok (tarka) }
    pada verify-aadhaar { nirgama: aadhaar-ok (tarka) }
    svasti
  }
}
smriti onboarding {
  pravah {
    pada collect-docs { nirgama: docs (tarka) }
    aavaha kyc
    svasti
  }
}
`)
    const result = run()
    expect(result.log.map(l => l.name)).toContain('collect-docs')
    expect(result.log.map(l => l.name)).toContain('verify-pan')
    expect(result.log.map(l => l.name)).toContain('verify-aadhaar')
  })

  it('aavaha anaapta propagates to parent', () => {
    const { run } = setup(`
smriti strict { pravah { anaapta } }
smriti parent {
  pravah {
    aavaha strict
    svasti
  }
}
`)
    const result = run()
    expect(result.outcome).toBe('anaapta')
  })

  it('aavaha of unknown target logs as skipped, flow continues', () => {
    const { run } = setup(`
smriti parent {
  pravah {
    aavaha nonexistent
    svasti
  }
}
`)
    const result = run()
    expect(result.outcome).toBe('svasti')
    expect(result.log.find(l => l.name === 'nonexistent')?.status).toBe('skipped')
  })

  it('nested aavaha — grandchild executes', () => {
    const { run } = setup(`
smriti grandchild {
  pravah {
    pada leaf-step { nirgama: x (tarka) }
    svasti
  }
}
smriti child {
  pravah {
    aavaha grandchild
    svasti
  }
}
smriti parent {
  pravah {
    aavaha child
    svasti
  }
}
`)
    const result = run()
    expect(result.outcome).toBe('svasti')
    expect(result.log.some(l => l.name === 'leaf-step')).toBe(true)
  })

  it('recursive aavaha exhausts shared budget', () => {
    const file = parse(`
smriti self-ref {
  pravah {
    aavaha self-ref
    svasti
  }
}
`)
    const env = buildKriyaEnv(file)
    const registry = buildRegistry(file)
    const decl = file.decls[0] as SmritiDecl
    // Use a small budget so the budget counter fires before JS call stack overflow
    expect(() => executeSmriti(decl, {}, env, registry, [30])).toThrow(/step limit exceeded/)
  })

  it('aavaha to sutra executes sutra pravah', () => {
    const file = typecheck(parse(`
sutra calculate {
  aagama: n (sankhya)
  pravah {
    pada compute { nirgama: result (sankhya) }
    svasti
  }
  nirgama: result (sankhya)
}
smriti parent {
  aagama: n (sankhya)
  pravah {
    aavaha calculate
      aagama: n (sankhya)
      nirgama: result (sankhya)
    svasti
  }
}
`))
    const env = buildKriyaEnv(file)
    const registry = buildRegistry(file)
    const decl = file.decls.find(d => d.kind === 'smriti') as SmritiDecl
    const result = executeSmriti(decl, { n: 42 }, env, registry)
    expect(result.outcome).toBe('svasti')
    expect(result.log.some(l => l.name === 'compute')).toBe(true)
  })
})
