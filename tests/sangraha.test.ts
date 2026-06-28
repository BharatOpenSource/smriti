import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toSchema } from '../src/backends/schema.js'
import type { SangrahaDecl } from '../src/ast.js'

function parseSangraha(src: string): SangrahaDecl {
  const file = parse(src)
  const decl = file.decls.find(d => d.kind === 'sangraha')
  if (!decl || decl.kind !== 'sangraha') throw new Error('expected sangraha decl')
  return decl
}

function run(src: string) { return typecheck(parse(src)) }

function schema(src: string): Record<string, unknown> {
  return JSON.parse(toSchema(typecheck(parse(src))))
}

// ─── Parser ────────────────────────────────────────────────────────────────

describe('sangraha — parser', () => {
  it('parses name and mukhya', () => {
    const decl = parseSangraha(`
      sangraha gst-filings {
        mukhya: filing-id (vakya)
        vivara: pan (vakya), amount (sankhya)
      }
    `)
    expect(decl.name).toBe('gst-filings')
    expect(decl.mukhya?.name).toBe('filing-id')
    expect(decl.mukhya?.type.kind).toBe('vakya')
  })

  it('parses vivara fields', () => {
    const decl = parseSangraha(`
      sangraha users {
        mukhya: id (vakya)
        vivara: name (vakya), age (sankhya), active (tarka)
      }
    `)
    expect(decl.vivara).toHaveLength(3)
    expect(decl.vivara[0].name).toBe('name')
    expect(decl.vivara[1].name).toBe('age')
    expect(decl.vivara[2].type.kind).toBe('tarka')
  })

  it('parses display name (itiName)', () => {
    const decl = parseSangraha(`
      sangraha filings "GST Filing Store" {
        mukhya: id (vakya)
      }
    `)
    expect(decl.itiName).toBe('GST Filing Store')
  })

  it('parses all four operation bindings', () => {
    const decl = parseSangraha(`
      sangraha products {
        mukhya: id (vakya)
        vivara: name (vakya), price (sankhya)
        likha:    upsert-product
        pathana:  get-product
        uddhaara: list-products
        lopa:     delete-product
      }
    `)
    expect(decl.likha).toBe('upsert-product')
    expect(decl.pathana).toBe('get-product')
    expect(decl.uddhaara).toBe('list-products')
    expect(decl.lopa).toBe('delete-product')
  })

  it('ops are all optional — schema-only sangraha is valid', () => {
    const decl = parseSangraha(`
      sangraha archive {
        mukhya: id (vakya)
        vivara: payload (patra)
      }
    `)
    expect(decl.likha).toBeUndefined()
    expect(decl.pathana).toBeUndefined()
    expect(decl.uddhaara).toBeUndefined()
    expect(decl.lopa).toBeUndefined()
  })

  it('parses optional vivara fields', () => {
    const decl = parseSangraha(`
      sangraha drafts {
        mukhya: id (vakya)
        vivara: title (vakya), vikalpa notes (vakya)
      }
    `)
    expect(decl.vivara[0].optional).toBe(false)
    expect(decl.vivara[1].optional).toBe(true)
  })

  it('parses sangraha alongside smriti', () => {
    const file = parse(`
      sangraha filings { mukhya: id (vakya) }
      smriti file-return { pravah { svasti } }
    `)
    expect(file.decls[0].kind).toBe('sangraha')
    expect(file.decls[1].kind).toBe('smriti')
  })

  it('parses mukhya with sankhya type', () => {
    const decl = parseSangraha(`
      sangraha items { mukhya: item-no (sankhya) vivara: name (vakya) }
    `)
    expect(decl.mukhya?.type.kind).toBe('sankhya')
  })

  it('parses partial ops — read-only store', () => {
    const decl = parseSangraha(`
      sangraha reference-data {
        mukhya: code (vakya)
        vivara: label (vakya)
        pathana:  get-by-code
        uddhaara: list-all
      }
    `)
    expect(decl.pathana).toBe('get-by-code')
    expect(decl.uddhaara).toBe('list-all')
    expect(decl.likha).toBeUndefined()
    expect(decl.lopa).toBeUndefined()
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────

describe('sangraha — typechecker', () => {
  it('accepts valid sangraha', () => {
    expect(() => run(`
      sangraha filings {
        mukhya: id (vakya)
        vivara: pan (vakya), amount (sankhya)
      }
    `)).not.toThrow()
  })

  it('rejects missing mukhya', () => {
    expect(() => run(`
      sangraha no-key {
        vivara: pan (vakya)
      }
    `)).toThrow(/mukhya.*required/)
  })

  it('rejects collection mukhya — krama not scalar', () => {
    expect(() => run(`
      sangraha bad-key {
        mukhya: ids (krama[vakya])
      }
    `)).toThrow(/must be a scalar type/)
  })

  it('rejects collection mukhya — kosa not scalar', () => {
    expect(() => run(`
      sangraha bad-key {
        mukhya: map (kosa[vakya, sankhya])
      }
    `)).toThrow(/must be a scalar type/)
  })

  it('rejects patra mukhya — not scalar', () => {
    expect(() => run(`
      sangraha bad-key {
        mukhya: doc (patra)
      }
    `)).toThrow(/must be a scalar type/)
  })

  it('accepts tarka mukhya — boolean is a valid scalar key', () => {
    expect(() => run(`
      sangraha flags { mukhya: enabled (tarka) }
    `)).not.toThrow()
  })

  it('rejects duplicate vivara field names', () => {
    expect(() => run(`
      sangraha dup {
        mukhya: id (vakya)
        vivara: status (vakya), status (tarka)
      }
    `)).toThrow(/duplicate field 'status'/)
  })

  it('accepts valid kriya binding for likha', () => {
    expect(() => run(`
      kriya upsert-item {
        aagama: id (vakya)
        nirgama: ok (tarka)
        ok = satya
      }
      sangraha items {
        mukhya: id (vakya)
        likha: upsert-item
      }
    `)).not.toThrow()
  })

  it('rejects unknown kriya in likha', () => {
    expect(() => run(`
      sangraha items {
        mukhya: id (vakya)
        likha: ghost-kriya
      }
    `)).toThrow(/likha bound to 'ghost-kriya' but no such kriya exists/)
  })

  it('rejects unknown kriya in pathana', () => {
    expect(() => run(`
      sangraha items {
        mukhya: id (vakya)
        pathana: missing-fn
      }
    `)).toThrow(/pathana bound to 'missing-fn'/)
  })

  it('rejects unknown kriya in uddhaara', () => {
    expect(() => run(`
      sangraha items {
        mukhya: id (vakya)
        uddhaara: no-fn
      }
    `)).toThrow(/uddhaara bound to 'no-fn'/)
  })

  it('rejects unknown kriya in lopa', () => {
    expect(() => run(`
      sangraha items {
        mukhya: id (vakya)
        lopa: no-fn
      }
    `)).toThrow(/lopa bound to 'no-fn'/)
  })

  it('binds to kriya inside a smriti block', () => {
    expect(() => run(`
      smriti my-process {
        kriya get-item {
          aagama: id (vakya)
          nirgama: name (vakya)
          name = id
        }
        pravah { svasti }
      }
      sangraha items {
        mukhya: id (vakya)
        pathana: get-item
      }
    `)).not.toThrow()
  })
})

// ─── Schema backend ───────────────────────────────────────────────────────

describe('toSchema', () => {
  it('emits version and stores array', () => {
    const doc = schema(`sangraha s { mukhya: id (vakya) }`)
    expect(doc.version).toBe('1.0')
    expect(Array.isArray(doc.stores)).toBe(true)
  })

  it('emits store name', () => {
    const doc = schema(`sangraha gst-filings { mukhya: id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].name).toBe('gst-filings')
  })

  it('emits title from itiName', () => {
    const doc = schema(`sangraha s "Filing Store" { mukhya: id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].title).toBe('Filing Store')
  })

  it('omits title when itiName absent', () => {
    const doc = schema(`sangraha s { mukhya: id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].title).toBeUndefined()
  })

  it('emits key from mukhya', () => {
    const doc = schema(`sangraha s { mukhya: filing-id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].key).toEqual({ name: 'filing-id', type: 'string' })
  })

  it('emits fields from vivara', () => {
    const doc = schema(`
      sangraha s {
        mukhya: id (vakya)
        vivara: pan (vakya), amount (sankhya), filed-at (tithi)
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    const fields = stores[0].fields as Array<Record<string, unknown>>
    expect(fields).toHaveLength(3)
    expect(fields[0]).toEqual({ name: 'pan',       type: 'string' })
    expect(fields[1]).toEqual({ name: 'amount',    type: 'number' })
    expect(fields[2]).toEqual({ name: 'filed-at',  type: 'string', format: 'date' })
  })

  it('optional vivara field includes optional:true', () => {
    const doc = schema(`
      sangraha s {
        mukhya: id (vakya)
        vivara: required-f (vakya), vikalpa opt-f (vakya)
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    const fields = stores[0].fields as Array<Record<string, unknown>>
    expect(fields[0].optional).toBeUndefined()
    expect(fields[1].optional).toBe(true)
  })

  it('emits operations when all four are declared', () => {
    const doc = schema(`
      kriya upsert-fn { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      kriya get-fn    { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      kriya list-fn   { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      kriya delete-fn { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      sangraha s {
        mukhya: id (vakya)
        likha:    upsert-fn
        pathana:  get-fn
        uddhaara: list-fn
        lopa:     delete-fn
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].operations).toEqual({
      write:  'upsert-fn',
      read:   'get-fn',
      query:  'list-fn',
      delete: 'delete-fn',
    })
  })

  it('omits operations key when no ops declared', () => {
    const doc = schema(`sangraha s { mukhya: id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].operations).toBeUndefined()
  })

  it('emits partial operations — read-only store', () => {
    const doc = schema(`
      kriya get-fn  { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      kriya list-fn { aagama: id (vakya) nirgama: ok (tarka)  ok = satya }
      sangraha s {
        mukhya: id (vakya)
        pathana:  get-fn
        uddhaara: list-fn
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    const ops = stores[0].operations as Record<string, string>
    expect(ops.read).toBe('get-fn')
    expect(ops.query).toBe('list-fn')
    expect(ops.write).toBeUndefined()
    expect(ops.delete).toBeUndefined()
  })

  it('emits multiple stores', () => {
    const doc = schema(`
      sangraha users    { mukhya: id (vakya) }
      sangraha products { mukhya: sku (vakya) vivara: price (sankhya) }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores).toHaveLength(2)
    expect(stores[0].name).toBe('users')
    expect(stores[1].name).toBe('products')
  })

  it('sankhya with constraints emits minimum/maximum', () => {
    const doc = schema(`
      sangraha ratings {
        mukhya: id (vakya)
        vivara: score (sankhya 1..5)
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    const fields = stores[0].fields as Array<Record<string, unknown>>
    expect(fields[0]).toEqual({ name: 'score', type: 'number', minimum: 1, maximum: 5 })
  })

  it('krama vivara field emits array schema', () => {
    const doc = schema(`
      sangraha batch {
        mukhya: id (vakya)
        vivara: tags (krama[vakya])
      }
    `)
    const stores = doc.stores as Array<Record<string, unknown>>
    const fields = stores[0].fields as Array<Record<string, unknown>>
    expect(fields[0]).toEqual({ name: 'tags', type: 'array', items: { type: 'string' } })
  })

  it('empty vivara emits empty fields array', () => {
    const doc = schema(`sangraha s { mukhya: id (vakya) }`)
    const stores = doc.stores as Array<Record<string, unknown>>
    expect(stores[0].fields).toEqual([])
  })
})
