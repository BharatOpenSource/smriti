import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { buildKriyaEnv } from '../src/evaluator.js'
import { buildSangrahaEnv } from '../src/registry.js'
import { executeSmriti } from '../src/executor.js'
import type { SmritiDecl } from '../src/ast.js'

// ─── Layer 6.2 — aavaha store.op flow wire-up ─────────────────────────────────

function check(src: string) { return typecheck(parse(src)) }

const STORE = `
  kriya upsert-item {
    aagama: id (vakya), name (vakya)
    nirgama: id (vakya)
    id = id
  }
  kriya get-item {
    aagama: id (vakya)
    nirgama: id (vakya), name (vakya)
    id = id
    name = id
  }
  sangraha items {
    mukhya: id (vakya)
    vivara: name (vakya)
    likha:   upsert-item
    pathana: get-item
  }
`

describe('aavaha store.op — typechecker', () => {
  it('accepts likha with aagama/nirgama matching store schema', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.likha
          aagama: id (vakya), name (vakya)
          nirgama: id (vakya)
        svasti
      } }
    `
    expect(() => check(src)).not.toThrow()
  })

  it('accepts pathana with mukhya in aagama and vivara subset in nirgama', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.pathana
          aagama: id (vakya)
          nirgama: name (vakya)
        svasti
      } }
    `
    expect(() => check(src)).not.toThrow()
  })

  it('rejects an operation name that is not one of likha/pathana/uddhaara/lopa', () => {
    const src = `${STORE}
      smriti t { pravah { aavaha items.frobnicate svasti } }
    `
    expect(() => check(src)).toThrow(/not a valid sangraha operation/)
  })

  it('rejects an operation that is not bound on the store', () => {
    const src = `${STORE}
      smriti t { pravah { aavaha items.lopa svasti } }
    `
    expect(() => check(src)).toThrow(/has no lopa operation bound/)
  })

  it('rejects an aagama field that is not part of the store schema', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.likha
          aagama: id (vakya), bogus (vakya)
        svasti
      } }
    `
    expect(() => check(src)).toThrow(/'bogus' is not a field on sangraha 'items'/)
  })

  it('rejects a field whose type does not match the store schema', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.likha
          aagama: id (vakya), name (sankhya)
        svasti
      } }
    `
    expect(() => check(src)).toThrow(/'name': declared as sankhya but sangraha field is vakya/)
  })

  it('rejects pathana whose aagama omits the mukhya field', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.pathana
          aagama: name (vakya)
          nirgama: name (vakya)
        svasti
      } }
    `
    expect(() => check(src)).toThrow(/aagama must include the mukhya field 'id'/)
  })

  it('does not require mukhya in aagama for likha (upsert provides the whole record)', () => {
    const src = `${STORE}
      smriti t { pravah {
        aavaha items.likha
          aagama: id (vakya), name (vakya)
        svasti
      } }
    `
    expect(() => check(src)).not.toThrow()
  })
})

describe('aavaha store.op — executor', () => {
  function run(src: string, initial: Record<string, unknown>) {
    const file = typecheck(parse(src))
    const decl = file.decls.find(d => d.kind === 'smriti') as SmritiDecl
    const env = buildKriyaEnv(file)
    const stores = buildSangrahaEnv(file)
    return executeSmriti(decl, initial as Record<string, string | number | boolean | null>, env, undefined, undefined, stores)
  }

  it('dispatches aavaha store.likha to the bound kriya and binds nirgama', () => {
    const src = `${STORE}
      smriti t {
        aagama: id (vakya), name (vakya)
        pravah {
          aavaha items.likha
            aagama: id (vakya), name (vakya)
            nirgama: id (vakya)
          svasti
        }
      }
    `
    const r = run(src, { id: 'abc123', name: 'Widget' })
    expect(r.outcome).toBe('svasti')
    expect(r.produced.id).toBe('abc123')
    expect(r.log[0]).toMatchObject({ name: 'items.likha', status: 'completed', produced: { id: 'abc123' } })
  })

  it('dispatches aavaha store.pathana to the bound kriya and returns fields', () => {
    const src = `${STORE}
      smriti t {
        aagama: id (vakya)
        pravah {
          aavaha items.pathana
            aagama: id (vakya)
            nirgama: name (vakya)
          svasti
        }
      }
    `
    const r = run(src, { id: 'xyz789' })
    expect(r.outcome).toBe('svasti')
    expect(r.produced.name).toBe('xyz789')
    expect(r.log[0]).toMatchObject({ name: 'items.pathana', status: 'completed', produced: { name: 'xyz789' } })
  })
})
