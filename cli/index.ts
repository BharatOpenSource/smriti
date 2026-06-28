#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports, parseRegistryUri, registryCachePath } from '../src/resolver.js'
import { toYaml } from '../src/backends/yaml.js'
import { toSutraYaml } from '../src/backends/sutra-yaml.js'
import { toSvg, type Script } from '../src/backends/svg.js'
import { toOpenApi } from '../src/backends/openapi.js'
import { toSchema } from '../src/backends/schema.js'
import { computeIntervalMs } from '../src/scheduler.js'
import { evaluateGhatana, evaluateKriya, buildKriyaEnv, type Payload } from '../src/evaluator.js'
import { executeSmriti } from '../src/executor.js'
import { buildRegistry } from '../src/registry.js'

const VERSION = '0.1.0'

const HELP = `
smr — Smriti language toolchain v${VERSION}

Usage:
  smr check <file.smr>                         Parse and type-check only
  smr compile <file.smr>                       Compile to YAML (default)
  smr compile --openapi <file.smr>             Emit OpenAPI 3.1 JSON from seva blocks
  smr compile --schema <file.smr>              Emit store schema JSON from sangraha blocks
  smr compile --svg <file.smr>                 Compile to SVG flow diagram
  smr compile --svg --script devanagari <file> SVG with Devanagari labels
  smr compile --out <path> <file.smr>          Write output to file
  smr run <file.smr>                           Execute smriti pravah and print outcome
  smr run <file.smr> --payload <json>          Execute pravah with external payload
  smr run <file.smr> --kriya <name>            Execute a named kriya and print nirgama
  smr run <file.smr> --kriya <name> --payload <json>  Execute kriya with aagama payload
  smr trigger <file.smr> --payload <json>      Evaluate ghatana against a payload
  smr schedule <file.smr>                      Run smriti on its hetu schedule (Ctrl+C to stop)
  smr schedule <file.smr> --once               Run once immediately (skips the timer)
  smr fetch <org/name@version>                 Prime local registry cache
  smr fetch <org/name@version> --from <file>   Cache a local file as a registry entry

Options:
  --help              Show this help
  --version           Show version
  --kriya <name>      Target kriya name (for smr run)
  --script <script>   Rendering script: latin (default) | devanagari
  --from <file>       Source file for smr fetch
`.trim()

const args = process.argv.slice(2)

if (args.length === 0 || args.includes('--help')) { console.log(HELP); process.exit(0) }
if (args.includes('--version')) { console.log(VERSION); process.exit(0) }

const command = args[0]
const outIdx    = args.indexOf('--out')
const outPath   = outIdx !== -1 ? args[outIdx + 1] : null
const scriptIdx = args.indexOf('--script')
const scriptArg = scriptIdx !== -1 ? args[scriptIdx + 1] : null
const fromIdx    = args.indexOf('--from')
const fromArg    = fromIdx !== -1 ? args[fromIdx + 1] : null
const payloadIdx = args.indexOf('--payload')
const payloadArg = payloadIdx !== -1 ? args[payloadIdx + 1] : null
const kriyaIdx   = args.indexOf('--kriya')
const kriyaArg   = kriyaIdx !== -1 ? args[kriyaIdx + 1] : null

const keyValueFlags = new Set(['--out', '--script', '--from', '--payload', '--kriya'])
const valuePositions = new Set<number>()
if (outIdx !== -1)     valuePositions.add(outIdx + 1)
if (scriptIdx !== -1)  valuePositions.add(scriptIdx + 1)
if (fromIdx !== -1)    valuePositions.add(fromIdx + 1)
if (payloadIdx !== -1) valuePositions.add(payloadIdx + 1)
if (kriyaIdx !== -1)   valuePositions.add(kriyaIdx + 1)

const flags = new Set(args.filter((a, i) =>
  a.startsWith('--') && !keyValueFlags.has(a) && !valuePositions.has(i)
))
const files = args.filter((a, i) =>
  !a.startsWith('--') && a !== command && !valuePositions.has(i)
)

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

    if (flags.has('--schema')) {
      const sangrahaDecls = ast.decls.filter(d => d.kind === 'sangraha')
      if (sangrahaDecls.length === 0) {
        console.error('smr compile --schema: no sangraha declarations found in file')
        process.exit(1)
      }
      output(toSchema(ast))
      return
    }

    if (flags.has('--openapi')) {
      const sevaDecls = ast.decls.filter(d => d.kind === 'seva')
      if (sevaDecls.length === 0) {
        console.error('smr compile --openapi: no seva declarations found in file')
        process.exit(1)
      }
      const title = ast.decls.find(d => d.kind === 'smriti')
        ? (ast.decls.find(d => d.kind === 'smriti') as { itiName?: string; name: string }).itiName
          ?? (ast.decls.find(d => d.kind === 'smriti') as { name: string }).name
        : 'Smriti API'
      output(toOpenApi(ast, title))
      return
    }

    if (decl.kind === 'seva') {
      console.error('smr compile: use --openapi to compile seva declarations')
      process.exit(1)
    }

    if (decl.kind === 'kriya') {
      console.error('smr: standalone kriya compile not yet supported — embed in a smriti or sutra')
      process.exit(1)
    }

    if (decl.kind === 'sutra') {
      if (flags.has('--svg')) {
        console.error('smr: --svg is not supported for sutra files'); process.exit(1)
      }
      output(toSutraYaml(decl))
      return
    }

    if (decl.kind === 'smriti') {
      if (flags.has('--svg')) {
        const script: Script = scriptArg === 'devanagari' ? 'devanagari' : 'latin'
        if (scriptArg && script === 'latin' && scriptArg !== 'latin') {
          console.error(`smr: unknown script '${scriptArg}' — use 'latin' or 'devanagari'`)
          process.exit(1)
        }
        output(toSvg(decl, { script }))
      } else {
        if (!decl.flow) {
          console.error('smr: this smriti has no pravah — YAML output requires a flow. Use --svg for a declaration diagram.')
          process.exit(1)
        }
        output(toYaml(decl))
      }
    }
    return
  }

  if (command === 'run') {
    const file = files[0]
    if (!file) { console.error('Usage: smr run <file.smr> [--kriya <name>] [--payload <json>]'); process.exit(1) }
    const source = readSource(file)
    let ast
    try {
      const abs = resolve(file)
      const parsed = parse(source)
      const context = resolveImports(parsed, abs)
      ast = typecheck(parsed, context)
    } catch (e) {
      console.error(String(e)); process.exit(1)
    }

    let payload: Payload = {}
    if (payloadArg) {
      try { payload = JSON.parse(payloadArg) as Payload }
      catch { console.error('smr run: --payload must be valid JSON'); process.exit(1) }
    }

    // ── smr run --kriya <name>: execute a named kriya ──────────────────────────
    if (kriyaArg) {
      const env = buildKriyaEnv(ast)
      const kriya = env.get(kriyaArg)
      if (!kriya) {
        console.error(`smr run: kriya '${kriyaArg}' not found in ${file}`)
        console.error(`  available: ${[...env.keys()].join(', ') || '(none)'}`)
        process.exit(1)
      }
      const argValues = kriya.aagama.map(f => payload[f.name] ?? null)
      const result = evaluateKriya(kriya, argValues, env)
      if (kriya.nirgama.length === 0) {
        console.log('(kriya has no nirgama — ran for side effects)')
      } else {
        const out: Record<string, unknown> = {}
        for (const f of kriya.nirgama) out[f.name] = result[f.name] ?? null
        console.log(JSON.stringify(out, null, 2))
      }
      return
    }

    // ── smr run <file.smr>: execute the smriti pravah ─────────────────────────
    // Use the LAST smriti in the file — helpers/sub-processes are declared first, root process last.
    const smritiDecls = ast.decls.filter(d => d.kind === 'smriti')
    const smritiDecl = smritiDecls[smritiDecls.length - 1]
    if (!smritiDecl || smritiDecl.kind !== 'smriti') {
      console.error('smr run: no smriti declaration found — use --kriya to run a specific kriya')
      process.exit(1)
    }
    const env = buildKriyaEnv(ast)
    const registry = buildRegistry(ast)
    let flowResult
    try {
      flowResult = executeSmriti(smritiDecl, payload, env, registry)
    } catch (e) {
      console.error(`smr run: ${String(e)}`); process.exit(1)
    }
    // Print step log
    for (const entry of flowResult.log) {
      const badge = entry.status === 'skipped' ? '[skip]' :
                    entry.status === 'auto-completed' ? '[auto]' : '[done]'
      const fields = Object.keys(entry.produced)
      const summary = fields.length ? ` → ${fields.map(k => `${k}: ${JSON.stringify(entry.produced[k])}`).join(', ')}` : ''
      console.log(`  ${badge} ${entry.name}${summary}`)
    }
    console.log(`\noutcome: ${flowResult.outcome}  (${flowResult.steps} steps)`)
    process.exit(flowResult.outcome === 'svasti' ? 0 : 1)
  }

  if (command === 'trigger') {
    const file = files[0]
    if (!file) { console.error('Usage: smr trigger <file.smr> [--payload <json>]'); process.exit(1) }
    const source = readSource(file)
    let ast
    try {
      const abs = resolve(file)
      const parsed = parse(source)
      const context = resolveImports(parsed, abs)
      ast = typecheck(parsed, context)
    } catch (e) {
      console.error(String(e)); process.exit(1)
    }
    const decl = ast.decls.find(d => d.kind === 'smriti')
    if (!decl || decl.kind !== 'smriti') {
      console.error('smr trigger: no smriti declaration found'); process.exit(1)
    }
    if (!decl.trigger) {
      console.log('(no ghatana declared — process fires unconditionally)')
      process.exit(0)
    }
    let payload: Payload = {}
    if (payloadArg) {
      try { payload = JSON.parse(payloadArg) as Payload }
      catch { console.error('smr trigger: --payload must be valid JSON'); process.exit(1) }
    }
    const kriyaEnv = buildKriyaEnv(ast)
    const result = evaluateGhatana(decl.trigger, payload, kriyaEnv)
    if (result.vrtti  !== undefined) console.log(`vrtti:  ${result.vrtti}`)
    if (result.karta  !== undefined) console.log(`karta:  ${JSON.stringify(result.karta)}`)
    if (result.sthala !== undefined) console.log(`sthala: ${JSON.stringify(result.sthala)}`)
    if (result.kaarya !== undefined) console.log(`kaarya: ${JSON.stringify(result.kaarya)}`)
    if (decl.trigger.hetu) {
      console.log(`hetu:   prati ${decl.trigger.hetu.quantity} ${decl.trigger.hetu.unit}`)
    }
    console.log(result.fires ? '→ process fires' : '→ process does not fire')
    process.exit(result.fires ? 0 : 1)
  }

  if (command === 'schedule') {
    const file = files[0]
    if (!file) { console.error('Usage: smr schedule <file.smr> [--payload <json>] [--once]'); process.exit(1) }
    const source = readSource(file)
    let ast
    try {
      const abs = resolve(file)
      const parsed = parse(source)
      const context = resolveImports(parsed, abs)
      ast = typecheck(parsed, context)
    } catch (e) {
      console.error(String(e)); process.exit(1)
    }

    const smritiDecls = ast.decls.filter(d => d.kind === 'smriti')
    const smritiDecl = smritiDecls[smritiDecls.length - 1]
    if (!smritiDecl || smritiDecl.kind !== 'smriti') {
      console.error('smr schedule: no smriti declaration found'); process.exit(1)
    }
    if (!smritiDecl.trigger?.hetu) {
      console.error(`smr schedule: '${smritiDecl.name}' has no hetu schedule — add a ghatana block with: hetu prati N <unit>`)
      process.exit(1)
    }

    const hetu = smritiDecl.trigger.hetu
    let intervalMs: number
    try {
      intervalMs = computeIntervalMs(hetu.quantity, hetu.unit)
    } catch (e) {
      console.error(String(e)); process.exit(1)
    }

    let payload: Payload = {}
    if (payloadArg) {
      try { payload = JSON.parse(payloadArg) as Payload }
      catch { console.error('smr schedule: --payload must be valid JSON'); process.exit(1) }
    }

    const env = buildKriyaEnv(ast)
    const registry = buildRegistry(ast)
    const runOnce = flags.has('--once')

    const label = `${smritiDecl.itiName ?? smritiDecl.name}`
    if (!runOnce) {
      console.log(`smr schedule: ${label} — every ${hetu.quantity} ${hetu.unit}`)
      console.log('(Ctrl+C to stop)\n')
    }

    let runCount = 0

    function executeRun() {
      runCount++
      const ts = new Date().toISOString()
      // Check vrtti condition before running
      if (smritiDecl!.trigger?.vrtti) {
        const ghatanaResult = evaluateGhatana(smritiDecl!.trigger, payload, env)
        if (!ghatanaResult.fires) {
          console.log(`[run ${runCount}] ${ts}  vrtti: ${ghatanaResult.vrtti} — skipped`)
          return
        }
      }
      let flowResult
      try {
        flowResult = executeSmriti(smritiDecl!, payload, env, registry)
      } catch (e) {
        console.log(`[run ${runCount}] ${ts}  error: ${String(e)}`)
        return
      }
      console.log(`[run ${runCount}] ${ts}  outcome: ${flowResult.outcome}  (${flowResult.steps} steps)`)
      for (const entry of flowResult.log) {
        const badge = entry.status === 'skipped' ? '[skip]' :
                      entry.status === 'auto-completed' ? '[auto]' : '[done]'
        const fields = Object.keys(entry.produced)
        const summary = fields.length ? ` → ${fields.map(k => `${k}: ${JSON.stringify(entry.produced[k])}`).join(', ')}` : ''
        console.log(`  ${badge} ${entry.name}${summary}`)
      }
    }

    if (runOnce) {
      executeRun()
      return
    }

    executeRun()
    setInterval(executeRun, intervalMs)
    return
  }

  if (command === 'fetch') {
    const uriArg = files[0]
    if (!uriArg) {
      console.error('Usage: smr fetch <org/name@version> [--from <file.smr>]')
      process.exit(1)
    }

    let uri
    try {
      uri = parseRegistryUri(uriArg)
    } catch (e) {
      console.error(String(e).replace(/^Error:\s*/, ''))
      process.exit(1)
    }

    const cachePath = registryCachePath(uri)

    if (!fromArg) {
      // Registry not yet live — show where to put the file manually.
      console.error(`smr: registry not yet live — no HTTP endpoint to fetch from.`)
      console.error(`To prime the cache manually:`)
      console.error(`  smr fetch ${uriArg} --from ./your-local-copy.smr`)
      console.error(`Cache path: ${cachePath}`)
      process.exit(1)
    }

    // --from <file>: read, validate, write to cache.
    const source = readSource(fromArg)
    try {
      const ast = parse(source)
      const context = resolveImports(ast, resolve(fromArg))
      typecheck(ast, context)
    } catch (e) {
      console.error(`smr fetch: source file failed validation`)
      console.error(String(e))
      process.exit(1)
    }

    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, source, 'utf8')
    console.log(`✓  Cached ${uriArg}`)
    console.log(`   ${cachePath}`)
    return
  }

  console.error(`smr: unknown command '${command}'`)
  console.error(HELP)
  process.exit(1)
}

run()
