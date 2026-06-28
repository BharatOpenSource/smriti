import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { evaluateKriya, buildKriyaEnv, buildInitialState } from '../src/evaluator.js'
import type { KriyaDecl, SmritiDecl, SutraDecl, SthitiBlock } from '../src/ast.js'

function tc(src: string) { return typecheck(parse(src)) }
function tcPass(src: string) { expect(() => tc(src)).not.toThrow() }
function tcFail(src: string, pattern: RegExp) { expect(() => tc(src)).toThrow(pattern) }

function parsedKriya(src: string, name: string): KriyaDecl {
  const file = parse(src)
  const k = file.decls.find(d => d.kind === 'kriya' && d.name === name) as KriyaDecl | undefined
  if (!k) throw new Error(`kriya '${name}' not found`)
  return k
}

function parsedSmriti(src: string): SmritiDecl {
  const file = parse(src)
  const d = file.decls.find(d => d.kind === 'smriti') as SmritiDecl | undefined
  if (!d) throw new Error('no smriti found')
  return d
}

// ─── Parser: sthiti-block ────────────────────────────────────────────────────

describe('parser — sthiti-block in kriya', () => {
  it('parses a minimal sthiti block', () => {
    const k = parsedKriya(`
kriya counter {
  sthiti {
    count (sankhya) = 0
  }
  nirgama: total (sankhya)
  total = count
}
`, 'counter')
    expect(k.sthitiBlock).toBeDefined()
    expect(k.sthitiBlock!.fields).toHaveLength(1)
    expect(k.sthitiBlock!.fields[0].name).toBe('count')
    expect(k.sthitiBlock!.fields[0].type).toMatchObject({ kind: 'sankhya' })
    expect(k.sthitiBlock!.fields[0].init).toBeDefined()
  })

  it('parses multiple sthiti fields', () => {
    const k = parsedKriya(`
kriya accumulator {
  sthiti {
    sum (sankhya) = 0
    calls (sankhya) = 0
    label (vakya) = "default"
  }
  nirgama: result (sankhya)
  result = sum
}
`, 'accumulator')
    expect(k.sthitiBlock!.fields).toHaveLength(3)
    expect(k.sthitiBlock!.fields[1].name).toBe('calls')
    expect(k.sthitiBlock!.fields[2].name).toBe('label')
  })

  it('parses optional sthiti field with no init', () => {
    const k = parsedKriya(`
kriya maybe {
  sthiti {
    vikalpa last-error (vakya)
  }
  nirgama: ok (tarka)
  ok = satya
}
`, 'maybe')
    const f = k.sthitiBlock!.fields[0]
    expect(f.optional).toBe(true)
    expect(f.init).toBeUndefined()
  })

  it('parses sthiti block in smriti body', () => {
    const d = parsedSmriti(`
smriti order-system {
  sthiti {
    order-count (sankhya) = 0
    total-revenue (sankhya) = 0
  }
  pravah { svasti }
}
`)
    expect(d.sthitiBlock).toBeDefined()
    expect(d.sthitiBlock!.fields).toHaveLength(2)
    expect(d.sthitiBlock!.fields[0].name).toBe('order-count')
  })

  it('parses sthiti block in sutra body', () => {
    const file = parse(`
sutra reusable-task {
  sthiti {
    retry-count (sankhya) = 0
  }
  pravah { svasti }
}
`)
    const d = file.decls[0] as SutraDecl
    expect(d.sthitiBlock).toBeDefined()
    expect(d.sthitiBlock!.fields[0].name).toBe('retry-count')
  })

  it('sthiti block is absent when not declared', () => {
    const k = parsedKriya(`kriya pure { nirgama: x (sankhya)  x = 1 }`, 'pure')
    expect(k.sthitiBlock).toBeUndefined()
  })

  it('parses sthiti with expression init', () => {
    const k = parsedKriya(`
kriya scaled {
  aagama: base (sankhya)
  sthiti {
    factor (sankhya) = 2
    threshold (sankhya) = 100
  }
  nirgama: result (sankhya)
  result = base * factor
}
`, 'scaled')
    expect(k.sthitiBlock!.fields[0].init?.kind).toBe('number-literal')
    expect(k.sthitiBlock!.fields[1].init?.kind).toBe('number-literal')
  })
})

// ─── Typechecker: sthiti-block valid cases ────────────────────────────────────

describe('typechecker — sthiti-block valid', () => {
  it('accepts minimal sthiti block in kriya', () => {
    tcPass(`
kriya counter {
  sthiti { count (sankhya) = 0 }
  nirgama: total (sankhya)
  total = count
}
`)
  })

  it('accepts sthiti block in smriti body', () => {
    tcPass(`
smriti process {
  sthiti { tally (sankhya) = 0 }
  pravah { svasti }
}
`)
  })

  it('accepts optional sthiti field without init', () => {
    tcPass(`
kriya safe {
  sthiti { vikalpa msg (vakya) }
  nirgama: ok (tarka)
  ok = satya
}
`)
  })

  it('sthiti fields are in scope for body stmts', () => {
    tcPass(`
kriya accumulate {
  aagama: value (sankhya)
  sthiti { total (sankhya) = 0 }
  nirgama: result (sankhya)
  total = total + value
  result = total
}
`)
  })

  it('accepts bool init for tarka field', () => {
    tcPass(`
kriya flagged {
  sthiti { active (tarka) = satya }
  nirgama: ok (tarka)
  ok = active
}
`)
  })

  it('accepts string init for vakya field', () => {
    tcPass(`
kriya labelled {
  sthiti { name (vakya) = "default" }
  nirgama: out (vakya)
  out = name
}
`)
  })

  it('accepts sthiti counts towards nirgama completeness', () => {
    // total is declared in sthiti and assigned in body — nirgama should pass
    tcPass(`
kriya with-state {
  sthiti { total (sankhya) = 0 }
  nirgama: total (sankhya)
  total = total + 1
}
`)
  })
})

// ─── Typechecker: sthiti-block error cases ────────────────────────────────────

describe('typechecker — sthiti-block errors', () => {
  it('rejects duplicate sthiti field name', () => {
    tcFail(`
kriya bad {
  sthiti { x (sankhya) = 0  x (sankhya) = 1 }
  nirgama: out (sankhya)
  out = x
}
`, /Duplicate sthiti field 'x'/)
  })

  it('rejects number init for tarka field', () => {
    tcFail(`
kriya bad {
  sthiti { flag (tarka) = 42 }
  nirgama: ok (tarka)
  ok = flag
}
`, /sthiti 'flag': init value is number but field type is tarka/)
  })

  it('rejects string init for sankhya field', () => {
    tcFail(`
kriya bad {
  sthiti { count (sankhya) = "hello" }
  nirgama: n (sankhya)
  n = count
}
`, /sthiti 'count': init value is string but field type is sankhya/)
  })

  it('rejects invalid type in sthiti field', () => {
    tcFail(`
kriya bad {
  sthiti { n (sankhya 10..5) = 0 }
  nirgama: out (sankhya)
  out = n
}
`, /min .* must not exceed max/)
  })

  it('rejects tarka init for sankhya field', () => {
    tcFail(`
kriya bad {
  sthiti { n (sankhya) = satya }
  nirgama: out (sankhya)
  out = n
}
`, /sthiti 'n': init value is tarka/)
  })
})

// ─── Evaluator: sthiti initial state ─────────────────────────────────────────

describe('evaluator — buildInitialState', () => {
  it('seeds initial values from sthiti block', () => {
    const k = parsedKriya(`
kriya counter {
  sthiti {
    count (sankhya) = 0
    label (vakya) = "start"
    active (tarka) = satya
  }
  nirgama: out (sankhya)
  out = count
}
`, 'counter')
    const env = new Map([['counter', k]])
    const state = buildInitialState(k.sthitiBlock!, env)
    expect(state['count']).toBe(0)
    expect(state['label']).toBe('start')
    expect(state['active']).toBe(true)
  })

  it('returns null for optional field with no init', () => {
    const k = parsedKriya(`
kriya maybe {
  sthiti { vikalpa msg (vakya) }
  nirgama: ok (tarka)
  ok = satya
}
`, 'maybe')
    const env = new Map([['maybe', k]])
    const state = buildInitialState(k.sthitiBlock!, env)
    expect(state['msg']).toBeNull()
  })

  it('evaluates expression init', () => {
    const k = parsedKriya(`
kriya scaled {
  sthiti { factor (sankhya) = 2 * 5 }
  nirgama: out (sankhya)
  out = factor
}
`, 'scaled')
    const env = new Map([['scaled', k]])
    const state = buildInitialState(k.sthitiBlock!, env)
    expect(state['factor']).toBe(10)
  })
})

describe('evaluator — sthiti in evaluateKriya', () => {
  it('sthiti fields available in body as initial locals', () => {
    const k = parsedKriya(`
kriya counter {
  aagama: delta (sankhya)
  sthiti { base (sankhya) = 100 }
  nirgama: result (sankhya)
  result = base + delta
}
`, 'counter')
    const env = new Map([['counter', k]])
    const result = evaluateKriya(k, [5], env)
    expect(result['result']).toBe(105)
  })

  it('sthiti field re-initialised per call (not persistent)', () => {
    const k = parsedKriya(`
kriya counter {
  aagama: delta (sankhya)
  sthiti { base (sankhya) = 100 }
  nirgama: result (sankhya)
  base = base + delta
  result = base
}
`, 'counter')
    const env = new Map([['counter', k]])
    // First call: 100 + 10 = 110
    expect(evaluateKriya(k, [10], env)['result']).toBe(110)
    // Second call: base is re-initialised to 100, so 100 + 10 = 110 again
    expect(evaluateKriya(k, [10], env)['result']).toBe(110)
  })

  it('aagama wins over same-named sthiti cell', () => {
    const k = parsedKriya(`
kriya override {
  aagama: x (sankhya)
  sthiti { x (sankhya) = 99 }
  nirgama: out (sankhya)
  out = x
}
`, 'override')
    const env = new Map([['override', k]])
    // aagama x=7 should win over sthiti x=99
    expect(evaluateKriya(k, [7], env)['out']).toBe(7)
  })

  it('accumulates within a single call', () => {
    const k = parsedKriya(`
kriya sum-three {
  aagama: a (sankhya), b (sankhya), c (sankhya)
  sthiti { running (sankhya) = 0 }
  nirgama: total (sankhya)
  running = running + a
  running = running + b
  running = running + c
  total = running
}
`, 'sum-three')
    const env = new Map([['sum-three', k]])
    expect(evaluateKriya(k, [1, 2, 3], env)['total']).toBe(6)
  })
})
