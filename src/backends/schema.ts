import type { SmritiFile, SangrahaDecl, TypedField, SmritiType } from '../ast.js'

type JsonField = Record<string, unknown>

function typeToJson(type: SmritiType): JsonField {
  switch (type.kind) {
    case 'vakya':      return { type: 'string', ...(type.pattern ? { pattern: type.pattern } : {}) }
    case 'sankhya':    return { type: 'number', ...(type.min !== undefined ? { minimum: type.min } : {}), ...(type.max !== undefined ? { maximum: type.max } : {}) }
    case 'bhinnaanka': return { type: 'number' }
    case 'dashaamsha': return { type: 'number', format: 'decimal' }
    case 'tarka':      return { type: 'boolean' }
    case 'tithi':      return { type: 'string', format: 'date' }
    case 'antara':     return { type: 'string', format: 'duration' }
    case 'patra':      return { type: 'object' }
    case 'krama':      return { type: 'array', items: typeToJson(type.of) }
    case 'kosa':       return { type: 'object', additionalProperties: typeToJson(type.value) }
  }
}

function fieldToJson(f: TypedField): JsonField {
  return {
    name: f.name,
    ...typeToJson(f.type),
    ...(f.optional ? { optional: true } : {}),
  }
}

export function toSchema(file: SmritiFile): string {
  const stores = file.decls
    .filter((d): d is SangrahaDecl => d.kind === 'sangraha')
    .map(s => {
      const ops: Record<string, string> = {}
      if (s.likha)    ops.write  = s.likha
      if (s.pathana)  ops.read   = s.pathana
      if (s.uddhaara) ops.query  = s.uddhaara
      if (s.lopa)     ops.delete = s.lopa

      return {
        name: s.name,
        ...(s.itiName ? { title: s.itiName } : {}),
        key: s.mukhya ? fieldToJson(s.mukhya) : null,
        fields: s.vivara.map(fieldToJson),
        ...(Object.keys(ops).length > 0 ? { operations: ops } : {}),
      }
    })

  return JSON.stringify({ version: '1.0', stores }, null, 2)
}
