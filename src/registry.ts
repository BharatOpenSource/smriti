import type { SmritiFile, SmritiDecl, SutraDecl, SangrahaDecl } from './ast.js'

export type ProcessDecl = SmritiDecl | SutraDecl

export interface Registry {
  get(name: string): ProcessDecl | undefined
  register(name: string, decl: ProcessDecl): void
  names(): string[]
}

export function buildRegistry(file: SmritiFile): Registry {
  const map = new Map<string, ProcessDecl>()
  for (const decl of file.decls) {
    if (decl.kind === 'smriti' || decl.kind === 'sutra') map.set(decl.name, decl)
  }
  return {
    get: (name) => map.get(name),
    register: (name, decl) => { map.set(name, decl) },
    names: () => [...map.keys()],
  }
}

// Maps sangraha (persistent store) name → declaration. Used by the executor to
// dispatch `aavaha store.op` steps to the kriya bound to that operation.
export type SangrahaEnv = Map<string, SangrahaDecl>

export function buildSangrahaEnv(file: SmritiFile): SangrahaEnv {
  const map: SangrahaEnv = new Map()
  for (const decl of file.decls) {
    if (decl.kind === 'sangraha') map.set(decl.name, decl)
  }
  return map
}
