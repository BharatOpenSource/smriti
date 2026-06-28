import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { toOpenApi } from '../src/backends/openapi.js'
import type { SevaDecl } from '../src/ast.js'

function parseSeva(src: string): SevaDecl {
  const file = parse(src)
  const decl = file.decls.find(d => d.kind === 'seva')
  if (!decl || decl.kind !== 'seva') throw new Error('expected seva decl')
  return decl
}

function run(src: string) {
  return typecheck(parse(src))
}

function openapi(src: string, title?: string): Record<string, unknown> {
  const file = typecheck(parse(src))
  return JSON.parse(toOpenApi(file, title))
}

// ─── Parser ────────────────────────────────────────────────────────────────

describe('seva parser', () => {
  it('parses method and path', () => {
    const decl = parseSeva(`
      seva create-filing {
        method: POST
        path: "/filings"
        aagama: pan (vakya)
        nirgama: filing-id (vakya)
      }
    `)
    expect(decl.name).toBe('create-filing')
    expect(decl.method).toBe('POST')
    expect(decl.path).toBe('/filings')
  })

  it('parses aagama and nirgama fields', () => {
    const decl = parseSeva(`
      seva submit {
        method: POST
        path: "/submit"
        aagama: name (vakya), amount (sankhya)
        nirgama: id (vakya), status (vakya)
      }
    `)
    expect(decl.aagama).toHaveLength(2)
    expect(decl.aagama[0].name).toBe('name')
    expect(decl.aagama[1].name).toBe('amount')
    expect(decl.nirgama).toHaveLength(2)
  })

  it('parses display name (itiName)', () => {
    const decl = parseSeva(`
      seva file-return "File GST Return" {
        method: POST
        path: "/returns"
        nirgama: id (vakya)
      }
    `)
    expect(decl.itiName).toBe('File GST Return')
  })

  it('parses optional fields in aagama', () => {
    const decl = parseSeva(`
      seva get-filing {
        method: GET
        path: "/filings/{id}"
        aagama: id (vakya), vikalpa format (vakya)
        nirgama: status (vakya)
      }
    `)
    expect(decl.aagama[0].optional).toBe(false)
    expect(decl.aagama[1].optional).toBe(true)
  })

  it('parses GET with no aagama', () => {
    const decl = parseSeva(`
      seva list-filings {
        method: GET
        path: "/filings"
        nirgama: count (sankhya)
      }
    `)
    expect(decl.aagama).toHaveLength(0)
    expect(decl.nirgama[0].name).toBe('count')
  })

  it('parses lowercase method (normalised to uppercase)', () => {
    const decl = parseSeva(`
      seva delete-filing {
        method: DELETE
        path: "/filings/{id}"
        aagama: id (vakya)
        nirgama: ok (tarka)
      }
    `)
    expect(decl.method).toBe('DELETE')
  })

  it('parses PUT and PATCH', () => {
    const put = parseSeva(`
      seva update-filing { method: PUT  path: "/filings/{id}" aagama: id (vakya) nirgama: id (vakya) }
    `)
    expect(put.method).toBe('PUT')
    const patch = parseSeva(`
      seva patch-filing { method: PATCH path: "/filings/{id}" aagama: id (vakya) nirgama: id (vakya) }
    `)
    expect(patch.method).toBe('PATCH')
  })

  it('parses multiple seva in one file', () => {
    const file = parse(`
      seva list   { method: GET  path: "/items"     nirgama: count (sankhya) }
      seva create { method: POST path: "/items"     aagama: name (vakya)  nirgama: id (vakya) }
    `)
    const sevas = file.decls.filter(d => d.kind === 'seva')
    expect(sevas).toHaveLength(2)
  })

  it('parses seva alongside smriti in one file', () => {
    const file = parse(`
      seva get-status { method: GET path: "/status" nirgama: ok (tarka) }
      smriti my-process {
        pravah { svasti }
      }
    `)
    expect(file.decls[0].kind).toBe('seva')
    expect(file.decls[1].kind).toBe('smriti')
  })
})

// ─── Typechecker ──────────────────────────────────────────────────────────

describe('seva typechecker', () => {
  it('accepts valid seva', () => {
    expect(() => run(`
      seva create-filing {
        method: POST
        path: "/filings"
        aagama: pan (vakya), amount (sankhya)
        nirgama: filing-id (vakya), status (vakya)
      }
    `)).not.toThrow()
  })

  it('rejects missing method', () => {
    expect(() => run(`
      seva no-method {
        path: "/filings"
        nirgama: id (vakya)
      }
    `)).toThrow(/method/)
  })

  it('rejects invalid method', () => {
    expect(() => run(`
      seva bad-method {
        method: FOOBAR
        path: "/filings"
        nirgama: id (vakya)
      }
    `)).toThrow(/invalid method/)
  })

  it('rejects missing path', () => {
    expect(() => run(`
      seva no-path {
        method: GET
        nirgama: id (vakya)
      }
    `)).toThrow(/path is required/)
  })

  it('rejects path not starting with slash', () => {
    expect(() => run(`
      seva bad-path {
        method: GET
        path: "filings"
        nirgama: id (vakya)
      }
    `)).toThrow(/must start with/)
  })

  it('rejects invalid aagama type', () => {
    expect(() => run(`
      seva bad-type {
        method: POST
        path: "/x"
        aagama: amount (sankhya -10..5)
      }
    `)).toThrow()
  })

  it('accepts all valid HTTP methods', () => {
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      expect(() => run(`
        seva m-${m.toLowerCase()} { method: ${m} path: "/x" nirgama: ok (tarka) }
      `)).not.toThrow()
    }
  })
})

// ─── OpenAPI backend ──────────────────────────────────────────────────────

describe('toOpenApi', () => {
  it('emits valid OpenAPI 3.1 envelope', () => {
    const doc = openapi(`
      seva create-filing {
        method: POST
        path: "/filings"
        aagama: pan (vakya)
        nirgama: filing-id (vakya)
      }
    `, 'GST API')
    expect(doc.openapi).toBe('3.1.0')
    expect((doc.info as Record<string, unknown>).title).toBe('GST API')
    expect((doc.info as Record<string, unknown>).version).toBe('0.1.0')
  })

  it('emits path + method', () => {
    const doc = openapi(`
      seva create-filing {
        method: POST
        path: "/filings"
        aagama: pan (vakya)
        nirgama: filing-id (vakya)
      }
    `)
    const paths = doc.paths as Record<string, unknown>
    expect(paths['/filings']).toBeDefined()
    const post = (paths['/filings'] as Record<string, unknown>).post as Record<string, unknown>
    expect(post.operationId).toBe('create-filing')
  })

  it('POST aagama → requestBody', () => {
    const doc = openapi(`
      seva submit {
        method: POST
        path: "/submit"
        aagama: name (vakya), amount (sankhya)
        nirgama: id (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/submit'] as Record<string, unknown>).post as Record<string, unknown>
    const rb = op.requestBody as Record<string, unknown>
    expect(rb.required).toBe(true)
    const schema = ((rb.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    expect((schema.properties as Record<string, unknown>)['name']).toEqual({ type: 'string' })
    expect((schema.properties as Record<string, unknown>)['amount']).toEqual({ type: 'number' })
    expect(schema.required).toEqual(['name', 'amount'])
  })

  it('GET aagama → query parameters', () => {
    const doc = openapi(`
      seva search {
        method: GET
        path: "/search"
        aagama: query (vakya), vikalpa limit (sankhya)
        nirgama: count (sankhya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/search'] as Record<string, unknown>).get as Record<string, unknown>
    const params = op.parameters as Array<Record<string, unknown>>
    expect(params).toHaveLength(2)
    expect(params[0]).toMatchObject({ name: 'query', in: 'query', required: true })
    expect(params[1]).toMatchObject({ name: 'limit', in: 'query', required: false })
  })

  it('path template params → in: path', () => {
    const doc = openapi(`
      seva get-filing {
        method: GET
        path: "/filings/{id}"
        aagama: id (vakya)
        nirgama: status (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/filings/{id}'] as Record<string, unknown>).get as Record<string, unknown>
    const params = op.parameters as Array<Record<string, unknown>>
    expect(params[0]).toMatchObject({ name: 'id', in: 'path', required: true })
  })

  it('nirgama → 200 response body', () => {
    const doc = openapi(`
      seva get-status {
        method: GET
        path: "/status"
        nirgama: ok (tarka), message (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/status'] as Record<string, unknown>).get as Record<string, unknown>
    const resp = (op.responses as Record<string, unknown>)['200'] as Record<string, unknown>
    const schema = ((resp.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    expect((schema.properties as Record<string, unknown>)['ok']).toEqual({ type: 'boolean' })
  })

  it('optional nirgama fields not in required array', () => {
    const doc = openapi(`
      seva partial {
        method: GET
        path: "/partial"
        nirgama: id (vakya), vikalpa detail (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/partial'] as Record<string, unknown>).get as Record<string, unknown>
    const resp = (op.responses as Record<string, unknown>)['200'] as Record<string, unknown>
    const schema = ((resp.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    expect(schema.required).toEqual(['id'])
  })

  it('multiple seva → multiple paths', () => {
    const doc = openapi(`
      seva list   { method: GET  path: "/items"  nirgama: count (sankhya) }
      seva create { method: POST path: "/items"  aagama: name (vakya)  nirgama: id (vakya) }
      seva get    { method: GET  path: "/items/{id}" aagama: id (vakya) nirgama: name (vakya) }
    `)
    const paths = doc.paths as Record<string, unknown>
    expect(Object.keys(paths)).toContain('/items')
    expect(Object.keys(paths)).toContain('/items/{id}')
    const itemPath = paths['/items'] as Record<string, unknown>
    expect(itemPath.get).toBeDefined()
    expect(itemPath.post).toBeDefined()
  })

  it('itiName used as summary and response description', () => {
    const doc = openapi(`
      seva file-return "File GST Return" {
        method: POST
        path: "/returns"
        nirgama: id (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/returns'] as Record<string, unknown>).post as Record<string, unknown>
    expect(op.summary).toBe('File GST Return')
    const resp = (op.responses as Record<string, unknown>)['200'] as Record<string, unknown>
    expect(resp.description).toBe('File GST Return')
  })

  it('sankhya with constraints maps to number with min/max', () => {
    const doc = openapi(`
      seva rate {
        method: POST
        path: "/rate"
        aagama: score (sankhya 0..100)
        nirgama: ok (tarka)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/rate'] as Record<string, unknown>).post as Record<string, unknown>
    const rb = op.requestBody as Record<string, unknown>
    const schema = ((rb.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    expect((schema.properties as Record<string, unknown>)['score']).toEqual({ type: 'number', minimum: 0, maximum: 100 })
  })

  it('krama maps to array schema', () => {
    const doc = openapi(`
      seva batch {
        method: POST
        path: "/batch"
        aagama: ids (krama[vakya])
        nirgama: count (sankhya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/batch'] as Record<string, unknown>).post as Record<string, unknown>
    const rb = op.requestBody as Record<string, unknown>
    const schema = ((rb.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    expect((schema.properties as Record<string, unknown>)['ids']).toEqual({ type: 'array', items: { type: 'string' } })
  })

  it('DELETE with path param', () => {
    const doc = openapi(`
      seva delete-item {
        method: DELETE
        path: "/items/{id}"
        aagama: id (vakya)
        nirgama: ok (tarka)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/items/{id}'] as Record<string, unknown>).delete as Record<string, unknown>
    expect(op).toBeDefined()
    const params = op.parameters as Array<Record<string, unknown>>
    expect(params[0]).toMatchObject({ name: 'id', in: 'path', required: true })
  })

  it('PUT body fields include both body and path params correctly', () => {
    const doc = openapi(`
      seva update-item {
        method: PUT
        path: "/items/{id}"
        aagama: id (vakya), name (vakya), amount (sankhya)
        nirgama: id (vakya)
      }
    `)
    const op = ((doc.paths as Record<string, unknown>)['/items/{id}'] as Record<string, unknown>).put as Record<string, unknown>
    const params = op.parameters as Array<Record<string, unknown>>
    expect(params).toHaveLength(1)  // only {id} as path param
    expect(params[0]).toMatchObject({ name: 'id', in: 'path' })
    const rb = op.requestBody as Record<string, unknown>
    const schema = ((rb.content as Record<string, unknown>)['application/json'] as Record<string, unknown>).schema as Record<string, unknown>
    const props = Object.keys(schema.properties as object)
    expect(props).toContain('name')
    expect(props).toContain('amount')
    expect(props).not.toContain('id')  // id is path param, not body
  })
})
