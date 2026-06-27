#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports } from '../src/resolver.js'
import { toYaml } from '../src/backends/yaml.js'
import { toSvg } from '../src/backends/svg.js'

const VERSION = '0.1.0'

const HELP = `
smr — Smriti language toolchain v${VERSION}

Usage:
  smr check <file.smr>                Parse and type-check only
  smr compile <file.smr>              Compile to YAML (default)
  smr compile --svg <file.smr>        Compile to SVG flow diagram
  smr compile --out <path> <file.smr> Write output to file

Options:
  --help      Show this help
  --version   Show version
`.trim()

const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help')) { console.log(HELP); process.exit(0) }
if (args.includes('--version')) { console.log(VERSION); process.exit(0) }

const command = args[0]
const outIdx = args.indexOf('--out')
const outPath = outIdx !== -1 ? args[outIdx + 1] : null
const flags = new Set(args.filter(a => a.startsWith('--') && a !== '--out' && a !== outPath))
const files = args.filter((a, i) => !a.startsWith('--') && a !== command && i !== outIdx + 1)

function readSource(path: string): string {
  try {
    return readFileSync(resolve(path), 'utf8')
  } catch {
    console.error(`smr: cannot read '${path}'`)
    process.exit(1)
  }
}

function output(content: string) {
  if (outPath) {
    writeFileSync(resolve(outPath), content, 'utf8')
    console.error(`smr: wrote ${outPath}`)
  } else {
    process.stdout.write(content + '\n')
  }
}

function run() {
  if (command === 'check') {
    const file = files[0]
    if (!file) { console.error('Usage: smr check <file>'); process.exit(1) }
    const source = readSource(file)
    try {
      const abs = resolve(file)
      const ast = parse(source)
      const context = resolveImports(ast, abs)
      typecheck(ast, context)
      console.log(`✓  ${file}`)
    } catch (e) {
      console.error(String(e))
      process.exit(1)
    }
    return
  }

  if (command === 'compile') {
    const file = files[0]
    if (!file) { console.error('Usage: smr compile [--svg] [--out <path>] <file>'); process.exit(1) }

    const source = readSource(file)
    let ast
    try {
      const abs = resolve(file)
      const parsed = parse(source)
      const context = resolveImports(parsed, abs)
      ast = typecheck(parsed, context)
    } catch (e) {
      console.error(String(e))
      process.exit(1)
    }

    const decl = ast.decls[0]
    if (!decl) { console.error('smr: no declarations found'); process.exit(1) }
    if (decl.kind !== 'smriti') { console.error('smr: sutra files compile to .sut — use a smriti file'); process.exit(1) }

    if (flags.has('--svg')) {
      output(toSvg(decl))
    } else {
      if (!decl.flow) {
        console.error('smr: this smriti has no pravah — YAML output requires a flow. Use --svg for a declaration diagram.')
        process.exit(1)
      }
      output(toYaml(decl))
    }
    return
  }

  console.error(`smr: unknown command '${command}'`)
  console.error(HELP)
  process.exit(1)
}

run()
