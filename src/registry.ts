import type { SmritiFile, SmritiDecl, SutraDecl } from './ast.js'

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
