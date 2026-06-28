import type { SmritiFile, SevaDecl, TypedField, SmritiType } from '../ast.js'

type JsonSchema = Record<string, unknown>

function smritiTypeToJsonSchema(type: SmritiType): JsonSchema {
  switch (type.kind) {
    case 'vakya': {
      const s: JsonSchema = { type: 'string' }
      if (type.pattern) s.pattern = type.pattern
      return s
    }
    case 'sankhya': {
      const s: JsonSchema = { type: 'number' }
      if (type.min !== undefined) s.minimum = type.min
      if (type.max !== undefined) s.maximum = type.max
      return s
    }
    case 'bhinnaanka': return { type: 'number' }
    case 'dashaamsha': return { type: 'number', format: 'decimal' }
    case 'tarka':      return { type: 'boolean' }
    case 'tithi':      return { type: 'string', format: 'date' }
    case 'antara':     return { type: 'string', format: 'duration' }
    case 'patra':      return { type: 'object' }
    case 'krama':      return { type: 'array', items: smritiTypeToJsonSchema(type.of) }
    case 'kosa':       return { type: 'object', additionalProperties: smritiTypeToJsonSchema(type.value) }
  }
}

function extractPathParams(path: string): string[] {
  return [...path.matchAll(/\{([^}]+)\}/g)].map(m => m[1])
}

function fieldsToSchema(fields: TypedField[]): JsonSchema {
  const properties: Record<string, JsonSchema> = {}
  const required: string[] = []
  for (const f of fields) {
    properties[f.name] = smritiTypeToJsonSchema(f.type)
    if (!f.optional) required.push(f.name)
  }
  const schema: JsonSchema = { type: 'object', properties }
  if (required.length > 0) schema.required = required
  return schema
}

export function toOpenApi(file: SmritiFile, title = 'Smriti API'): string {
  const sevaDecls = file.decls.filter((d): d is SevaDecl => d.kind === 'seva')

  const paths: Record<string, Record<string, unknown>> = {}

  for (const seva of sevaDecls) {
    const pathParams = extractPathParams(seva.path)
    const method = seva.method.toLowerCase()
    const isBody = method === 'post' || method === 'put' || method === 'patch'

    if (!paths[seva.path]) paths[seva.path] = {}

    const parameters: unknown[] = []
    const bodyFields: TypedField[] = []

    for (const f of seva.aagama) {
      if (pathParams.includes(f.name)) {
        parameters.push({
          name: f.name,
          in: 'path',
          required: true,
          schema: smritiTypeToJsonSchema(f.type),
        })
      } else if (isBody) {
        bodyFields.push(f)
      } else {
        parameters.push({
          name: f.name,
          in: 'query',
          required: !f.optional,
          schema: smritiTypeToJsonSchema(f.type),
        })
      }
    }

    const operation: Record<string, unknown> = {
      operationId: seva.name,
      summary: seva.itiName ?? seva.name,
    }

    if (parameters.length > 0) operation.parameters = parameters

    if (isBody && bodyFields.length > 0) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: fieldsToSchema(bodyFields) } },
      }
    }

    operation.responses = {
      '200': {
        description: seva.itiName ?? 'Success',
        ...(seva.nirgama.length > 0
          ? { content: { 'application/json': { schema: fieldsToSchema(seva.nirgama) } } }
          : {}),
      },
    }

    paths[seva.path][method] = operation
  }

  return JSON.stringify(
    { openapi: '3.1.0', info: { title, version: '0.1.0' }, paths },
    null,
    2,
  )
}
