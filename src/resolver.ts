import { readFileSync } from 'node:fs'
import { resolve as resolvePath, dirname } from 'node:path'
import { parse } from './parser.js'
import { typecheck } from './typechecker.js'
import type { SmritiFile, PakshaDecl, SangamaDecl } from './ast.js'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ResolvedNamespace {
  namespace: string
  participants: PakshaDecl[]
  // future: types, rules — add here as language grows
}

export interface ResolveContext {
  imports: Map<string, ResolvedNamespace>
}

// ─── Resolver interface — pluggable strategy ──────────────────────────────────

export interface SmritiResolver {
  // Returns the source text of the referenced file.
  load(yuja: string, fromPath: string): string
  // Returns a canonical key used to detect circular imports.
  canonical(yuja: string, fromPath: string): string
}

export class RelativeFileResolver implements SmritiResolver {
  load(yuja: string, fromPath: string): string {
    const abs = resolvePath(dirname(fromPath), yuja)
    try {
      return readFileSync(abs, 'utf8')
    } catch {
      throw new Error(
        `Cannot read import '${yuja}' — resolved to '${abs}'\n` +
        `Check that the file exists and the path is relative to the importing file.`,
      )
    }
  }
  canonical(yuja: string, fromPath: string): string {
    return resolvePath(dirname(fromPath), yuja)
  }
}

export class RegistryResolver implements SmritiResolver {
  load(yuja: string, _fromPath: string): string {
    throw new Error(
      `Registry imports not yet supported: '${yuja}'\n` +
      `Use a relative path instead: yuja: "./path/to/file.smr"`,
    )
  }
  canonical(yuja: string, _fromPath: string): string { return yuja }
}

// ─── Strategy selection ───────────────────────────────────────────────────────

function pickResolver(yuja: string): SmritiResolver {
  // Relative paths start with ./ or ../ or / or end with .smr / .sut
  const isRelative = yuja.startsWith('.') || yuja.startsWith('/') ||
                     yuja.endsWith('.smr') || yuja.endsWith('.sut')
  return isRelative ? new RelativeFileResolver() : new RegistryResolver()
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function resolveImports(
  file: SmritiFile,
  fromPath: string,
  resolver?: SmritiResolver,
): ResolveContext {
  const context: ResolveContext = { imports: new Map() }
  const visiting = new Set<string>()
  resolveFile(file, fromPath, resolver, visiting, context)
  return context
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function resolveFile(
  file: SmritiFile,
  fromPath: string,
  resolver: SmritiResolver | undefined,
  visiting: Set<string>,
  context: ResolveContext,
) {
  for (const decl of file.decls) {
    if (decl.kind !== 'smriti') continue
    for (const ref of decl.references) {
      if (ref.kind === 'sangama') {
        resolveSangama(ref, fromPath, resolver, visiting, context)
      }
    }
  }
}

function resolveSangama(
  sangama: SangamaDecl,
  fromPath: string,
  resolverOverride: SmritiResolver | undefined,
  visiting: Set<string>,
  context: ResolveContext,
) {
  const r = resolverOverride ?? pickResolver(sangama.yuja)
  const key = r.canonical(sangama.yuja, fromPath)

  if (visiting.has(key)) {
    throw new Error(
      `Circular import: '${sangama.yuja}' is already being loaded in this import chain.\n` +
      `Import chain includes: ${[...visiting].join(' → ')}`,
    )
  }

  // Diamond imports (A→B, A→C, B→C) are fine — only true cycles are rejected.
  // If already resolved under this namespace, skip.
  if (context.imports.has(sangama.name)) return

  visiting.add(key)

  const source = r.load(sangama.yuja, fromPath)
  const importedFile = parse(source)
  // Typecheck the imported file on its own (without its own imports for now).
  // Full transitive typecheck happens after all imports are resolved.
  typecheck(importedFile)

  // Collect what this file exports
  const participants: PakshaDecl[] = []
  for (const decl of importedFile.decls) {
    if (decl.kind === 'smriti') {
      participants.push(...decl.participants)
    }
  }

  context.imports.set(sangama.name, { namespace: sangama.name, participants })

  // Recursively resolve the imported file's own imports — they get their own namespace entries.
  resolveFile(importedFile, key, resolverOverride, visiting, context)

  visiting.delete(key)
}
