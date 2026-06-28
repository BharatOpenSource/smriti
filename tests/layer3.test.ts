import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { evaluateKriya, buildKriyaEnv } from '../src/evaluator.js'
import { nullEffectAdapter } from '../src/effects.js'
import type { KriyaDecl } from '../src/ast.js'

function tc(src: string) { return typecheck(parse(src)) }
function tcPass(src: string) { expect(() => tc(src)).not.toThrow() }

function parsedKriya(src: string, name: string): KriyaDecl {
  const file = parse(src)
  const k = file.decls.find(d => d.kind === 'kriya' && d.name === name) as KriyaDecl | undefined
  if (!k) throw new Error(`kriya '${name}' not found`)
  return k
}

// ─── Pure enforcement ─────────────────────────────────────────────────────────

describe('pure enforcement — valid', () => {
  it('pure kriya calling another pure kriya passes', () => {
    tcPass(`
kriya pure-helper {
  nirgama: x (sankhya)
  x = 42
}
kriya pure-caller {
  nirgama: result (sankhya)
  result = pure-helper()
}
`)
  })

  it('impure kriya calling another impure kriya passes', () => {
    tcPass(`
kriya fetch-data {
  sparsha { http: read }
  nirgama: ok (tarka)
  ok = satya
}
kriya impure-caller {
  sparsha { http: read }
  nirgama: result (tarka)
  result = fetch-data()
}
`)
  })

  it('impure kriya calling a pure kriya passes', () => {
    tcPass(`
kriya validate {
  aagama: amount (sankhya)
  nirgama: ok (tarka)
  ok = amount > 0
}
kriya impure-with-pure-call {
  sparsha { http: read }
  aagama: amount (sankhya)
  nirgama: result (tarka)
  result = validate(amount)
}
`)
  })

  it('pure kriya with no calls passes', () => {
    tcPass(`
kriya compute {
  aagama: a (sankhya), b (sankhya)
  nirgama: total (sankhya)
  total = a + b
}
`)
  })

  it('impure kriya scoped inside smriti may call another impure kriya', () => {
    tcPass(`
smriti system {
  kriya fetch {
    sparsha { http: read }
    nirgama: ok (tarka)
    ok = satya
  }
  kriya process {
    sparsha { http: read }
    nirgama: result (tarka)
    result = fetch()
  }
  pravah { svasti }
}
`)
  })
})

describe('pure enforcement — errors', () => {
  it('rejects pure kriya calling impure kriya (top-level)', () => {
    expect(() => tc(`
kriya fetch-gstin {
  sparsha { http: read }
  nirgama: ok (tarka)
  ok = satya
}
kriya pure-caller {
  nirgama: result (tarka)
  result = fetch-gstin()
}
`)).toThrow(/pure kriya 'pure-caller' calls impure kriya 'fetch-gstin'/)
  })

  it('rejects pure kriya calling impure kriya in assign rhs', () => {
    expect(() => tc(`
kriya emit-event {
  sparsha { event: emit }
  nirgama: sent (tarka)
  sent = satya
}
kriya pure {
  nirgama: ok (tarka)
  ok = emit-event()
}
`)).toThrow(/pure kriya 'pure' calls impure kriya 'emit-event'/)
  })

  it('rejects impure call as expr-stmt in pure kriya', () => {
    expect(() => tc(`
kriya write-file {
  sparsha { file: write }
  nirgama: done (tarka)
  done = satya
}
kriya pure {
  nirgama: x (tarka)
  write-file()
  x = satya
}
`)).toThrow(/pure kriya 'pure' calls impure kriya 'write-file'/)
  })

  it('error message includes hint to add sparsha block', () => {
    expect(() => tc(`
kriya impure { sparsha { http: read } nirgama: ok (tarka)  ok = satya }
kriya caller  { nirgama: result (tarka)  result = impure() }
`)).toThrow(/add a sparsha block to 'caller' to declare its effects/)
  })

  it('rejects impure call nested inside arithmetic', () => {
    expect(() => tc(`
kriya get-count {
  sparsha { http: read }
  nirgama: count (sankhya)
  count = 5
}
kriya pure-math {
  nirgama: result (sankhya)
  result = get-count() + 1
}
`)).toThrow(/pure kriya 'pure-math' calls impure kriya 'get-count'/)
  })
})

// ─── Effect adapter interface ──────────────────────────────────────────────────

describe('EffectAdapter interface', () => {
  it('nullHttpAdapter returns sentinel values', async () => {
    const r = await nullEffectAdapter.http!.get('http://example.com')
    expect(r.status).toBe(0)
    expect(r.body).toBe('')
  })

  it('nullFileAdapter read returns empty string', async () => {
    const r = await nullEffectAdapter.file!.read('/tmp/test')
    expect(r).toBe('')
  })

  it('nullFileAdapter write does not throw', async () => {
    await expect(nullEffectAdapter.file!.write('/tmp/test', 'hello')).resolves.not.toThrow()
  })

  it('nullEventAdapter emit does not throw', async () => {
    await expect(nullEffectAdapter.event!.emit('test', { x: 1 })).resolves.not.toThrow()
  })

  it('nullHttpAdapter post returns sentinel values', async () => {
    const r = await nullEffectAdapter.http!.post('http://example.com', '{"x":1}')
    expect(r.status).toBe(0)
    expect(r.body).toBe('')
  })
})

// ─── smr run (evaluator path used by CLI) ─────────────────────────────────────

describe('smr run — kriya execution via evaluateKriya', () => {
  it('runs a pure kriya and returns nirgama', () => {
    const src = `
kriya add {
  aagama: a (sankhya), b (sankhya)
  nirgama: total (sankhya)
  total = a + b
}
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('add')!
    const result = evaluateKriya(k, [3, 4], env)
    expect(result['total']).toBe(7)
  })

  it('runs a kriya with sthiti and returns correct output', () => {
    const src = `
kriya accumulate {
  aagama: delta (sankhya)
  sthiti { base (sankhya) = 100 }
  nirgama: result (sankhya)
  result = base + delta
}
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('accumulate')!
    expect(evaluateKriya(k, [25], env)['result']).toBe(125)
  })

  it('runs a kriya that chains to another kriya', () => {
    const src = `
kriya double { aagama: x (sankhya)  nirgama: r (sankhya)  r = x * 2 }
kriya quadruple { aagama: x (sankhya)  nirgama: r (sankhya)  r = double(double(x)) }
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('quadruple')!
    expect(evaluateKriya(k, [5], env)['r']).toBe(20)
  })

  it('aagama fields are matched by position (as the CLI does)', () => {
    const src = `
kriya subtract { aagama: a (sankhya), b (sankhya)  nirgama: diff (sankhya)  diff = a - b }
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('subtract')!
    // CLI maps payload by name, then passes positionally
    const payload: Record<string, unknown> = { a: 10, b: 3 }
    const argValues = k.aagama.map(f => (payload[f.name] ?? null) as number | null)
    expect(evaluateKriya(k, argValues, env)['diff']).toBe(7)
  })

  it('missing aagama fields default to null (avyakta)', () => {
    const src = `
kriya safe-add {
  aagama: a (sankhya), b (sankhya)
  nirgama: total (sankhya)
  total = a + b
}
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('safe-add')!
    // b is missing → null
    expect(evaluateKriya(k, [5, null], env)['total']).toBeNull()
  })

  it('kriya with multiple nirgama fields — all accessible in result', () => {
    const src = `
kriya split {
  aagama: n (sankhya)
  nirgama: half (sankhya), double (sankhya)
  half = n / 2
  double = n * 2
}
`
    const file = parse(src)
    typecheck(file)
    const env = buildKriyaEnv(file)
    const k = env.get('split')!
    const result = evaluateKriya(k, [10], env)
    expect(result['half']).toBe(5)
    expect(result['double']).toBe(20)
  })
})
