#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { parse } from '../src/parser.js'

const [,, file] = process.argv

if (!file) {
  console.error('Usage: smr <file.smr>')
  process.exit(1)
}

const source = readFileSync(file, 'utf8')

try {
  const ast = parse(source)
  console.log(JSON.stringify(ast, null, 2))
} catch (err) {
  console.error(String(err))
  process.exit(1)
}
