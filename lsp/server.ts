import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  TextDocumentSyncKind,
  InitializeResult,
  Diagnostic,
  DiagnosticSeverity,
  Hover,
  MarkupKind,
  TextDocumentPositionParams,
  Range,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { lex, TokenKind } from '../src/lexer.js'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { resolveImports } from '../src/resolver.js'
import type { ResolveContext } from '../src/resolver.js'

const connection = createConnection(ProposedFeatures.all)
const documents = new TextDocuments(TextDocument)

connection.onInitialize((_params: InitializeParams): InitializeResult => ({
  capabilities: {
    textDocumentSync: TextDocumentSyncKind.Incremental,
    hoverProvider: true,
  },
}))

// ─── Diagnostics ─────────────────────────────────────────────────────────────

function validate(doc: TextDocument): Diagnostic[] {
  const source = doc.getText()
  const diags: Diagnostic[] = []

  try {
    const ast = parse(source)
    let context: ResolveContext | undefined
    try {
      // Resolve imports — LSP converts file URI to path for relative resolution.
      // Fails gracefully if files can't be found (don't crash the server).
      const filePath = doc.uri.replace(/^file:\/\//, '')
      context = resolveImports(ast, filePath)
    } catch (importErr) {
      const msg = String(importErr).replace(/^Error:\s*/, '')
      diags.push({
        severity: DiagnosticSeverity.Warning,
        range: lineRange(doc, 0),
        message: `Import resolution: ${msg}`,
        source: 'smr',
      })
    }
    try {
      typecheck(ast, context)
    } catch (e) {
      // Typecheck error — may be multi-error string; split and report each
      const msg = String(e).replace(/^Error:\s*/, '')
      const lines = msg.startsWith('Type errors:')
        ? msg.replace('Type errors:\n', '').split('\n')
        : [msg]
      for (const line of lines) {
        const pos = extractPos(line)
        diags.push({
          severity: DiagnosticSeverity.Error,
          range: pos ? docRange(doc, pos.line, pos.character) : lineRange(doc, 0),
          message: line.replace(/^\[\d+:\d+\]\s*/, ''),
          source: 'smr',
        })
      }
    }
  } catch (e) {
    // Parse or lex error
    const msg = String(e).replace(/^(Error|LexError|ParseError):\s*/, '')
    const pos = extractPos(msg)
    diags.push({
      severity: DiagnosticSeverity.Error,
      range: pos ? docRange(doc, pos.line, pos.character) : lineRange(doc, 0),
      message: msg.replace(/^\[\d+:\d+\]\s*/, ''),
      source: 'smr',
    })
  }

  return diags
}

documents.onDidChangeContent((change: { document: ReturnType<typeof documents.get> & TextDocument }) => {
  const diags = validate(change.document)
  connection.sendDiagnostics({ uri: change.document.uri, diagnostics: diags })
})

documents.onDidOpen((event: { document: TextDocument }) => {
  const diags = validate(event.document)
  connection.sendDiagnostics({ uri: event.document.uri, diagnostics: diags })
})

// ─── Hover ───────────────────────────────────────────────────────────────────

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri)
  if (!doc) return null

  const source = doc.getText()
  let tokens
  try { tokens = lex(source) } catch { return null }

  const { line, character } = params.position
  const token = tokens.find(t =>
    t.pos.line - 1 === line &&
    character >= t.pos.col - 1 &&
    character < t.pos.col - 1 + t.value.length,
  )

  if (!token) return null
  const info = KEYWORD_DOCS[token.kind]
  if (!info) return null

  return {
    contents: { kind: MarkupKind.Markdown, value: info },
    range: {
      start: { line, character: token.pos.col - 1 },
      end:   { line, character: token.pos.col - 1 + token.value.length },
    },
  }
})

// ─── Keyword documentation ────────────────────────────────────────────────────

const KEYWORD_DOCS: Partial<Record<TokenKind, string>> = {
  [TokenKind.SMRITI]:     '**smriti** (स्मृति) — Complete process definition. Outer container of a `.smr` file.',
  [TokenKind.SUTRA]:      '**sutra** (सूत्र) — Reusable building block. Outer container of a `.sut` file.',
  [TokenKind.PAKSHA]:     '**paksha** (पक्ष) — A named participant: a specific person, organisation, or system.',
  [TokenKind.BHUMIKA]:    '**bhumika** (भूमिका) — The abstract role a participant fills (e.g. "verifying officer").',
  [TokenKind.ADHIKARA]:   '**adhikara** (अधिकार) — A right or entitlement held by a participant.',
  [TokenKind.PRAMANA]:    '**pramana** (प्रमाण) — Legal or normative authority backing a right (the citation).',
  [TokenKind.ADHIPATI]:   '**adhipati** (अधिपति) — The owner or author of this process.',
  [TokenKind.AAVARTANA]:  '**aavartana** (आवर्तन) — Version of this process.',
  [TokenKind.STARA]:      '**stara** (स्तर) — Access level: `public`, `restricted`, or `private`.',
  [TokenKind.AVADHI]:     '**avadhi** (अवधि) — Compliance delay: days before a change takes effect.',
  [TokenKind.PRABHAAVA]:  '**prabhaava** (प्रभाव) — Effective date: when this version comes into force.',
  [TokenKind.STHALA]:     '**sthala** (स्थल) — Specific jurisdiction or place.',
  [TokenKind.KSHETRA]:    '**kshetra** (क्षेत्र) — Broader region or domain.',
  [TokenKind.SANGAMA]:    '**sangama** (संगम) — External reference: where this flow meets another process or system.',
  [TokenKind.LAGNA]:      '**lagna** (लग्न) — Pinpointed reference: exact who, what, when, where.',
  [TokenKind.YUJA]:       '**yuja** (युज) — Import connector: the URI or identifier that connects a reference.',
  [TokenKind.GHATANA]:    '**ghatana** (घटना) — Process trigger: what starts this process.',
  [TokenKind.VRTTI]:      '**vrtti** (वृत्ति) — Trigger sub-type: a condition becoming true.',
  [TokenKind.HETU]:       '**hetu** (हेतु) — Trigger sub-type: a cause, purpose, or schedule.',
  [TokenKind.PRAVAH]:     '**pravah** (प्रवाह) — Flow block: container for all steps and routing.',
  [TokenKind.PADA]:       '**pada** (पद) — A single named step in the flow.',
  [TokenKind.KARTA]:      '**karta** (कर्ता) — The actor who performs this step.',
  [TokenKind.KAARYA]:     '**kaarya** (कार्य) — The action: what this step does.',
  [TokenKind.AAGAMA]:     '**aagama** (आगम) — Inputs to this step.',
  [TokenKind.NIRGAMA]:    '**nirgama** (निर्गम) — Outputs of this step.',
  [TokenKind.SAMAYA]:     '**samaya** (समय) — Per-step time limit (TTL/SLA).',
  [TokenKind.KHANDA]:     '**khanda** (खण्ड) — Guard clause: condition that must be true before this step runs.',
  [TokenKind.PRAVRITTI]:  '**pravritti** (प्रवृत्ति) — Forward movement: proceed to the named step.',
  [TokenKind.PRATIVRITTI]:'**prativritti** (प्रतिवृत्ति) — Loop back to a previous step.',
  [TokenKind.SVASTI]:     '**svasti** (स्वस्ति) — Success terminal: process ends here successfully.',
  [TokenKind.ANAAPTA]:    '**anaapta** (अनाप्त) — Failure terminal: process ends here rejected or failed.',
  [TokenKind.VIBHAGA]:    '**vibhaga** (विभाग) — Branching point: multiple exclusive paths from one condition.',
  [TokenKind.NIYAMA]:     '**niyama** (नियम) — Condition evaluated at a branch point.',
  [TokenKind.ANUBHAGA]:   '**anubhaga** (अनुभाग) — Parallel split: launch concurrent tracks.',
  [TokenKind.ANUGAMA]:    '**anugama** (अनुगम) — Parallel join: wait for all concurrent tracks to complete.',
  [TokenKind.AAVAHA]:     '**aavaha** (आवाह) — Sub-process invocation: call another `.smr` process.',
  [TokenKind.VARNA]:      '**varna** (वर्ण) — Named variable / data binding between steps.',
  [TokenKind.STHITI]:     '**sthiti** (स्थिति) — Named intermediate workflow state.',
  [TokenKind.SANKHYA]:    '**sankhya** (संख्या) — Type: whole number.',
  [TokenKind.BHINNAANKA]: '**bhinnaanka** (भिन्नांक) — Type: fraction (1/3, 3/7).',
  [TokenKind.DASHAAMSHA]: '**dashaamsha** (दशांश) — Type: decimal (3.14, 0.5).',
  [TokenKind.VAKYA]:      '**vakya** (वाक्य) — Type: text string.',
  [TokenKind.TITHI]:      '**tithi** (तिथि) — Type: calendar date.',
  [TokenKind.ANTARA]:     '**antara** (अन्तर) — Type: time span (e.g. 30 antara = 30 days).',
  [TokenKind.TARKA]:      '**tarka** (तर्क) — Type: trivalent logic. Values: `satya` (true), `asatya` (false), `avyakta` (indeterminate).',
  [TokenKind.PATRA]:      '**patra** (पत्र) — Type: document or file reference.',
  [TokenKind.KRAMA]:      '**krama** (क्रम) — Type: ordered list/sequence. Usage: `krama[type]`.',
  [TokenKind.KOSA]:       '**kosa** (कोश) — Type: key-value map/dictionary. Usage: `kosa[key-type, value-type]`.',
  [TokenKind.VIKALPA]:    '**vikalpa** (विकल्प) — Optional modifier: marks a field as not required. From Panini\'s grammar for optional rules.',
  [TokenKind.SATYA]:      '**satya** (सत्य) — `tarka` value: true.',
  [TokenKind.ASATYA]:     '**asatya** (असत्य) — `tarka` value: false.',
  [TokenKind.AVYAKTA]:    '**avyakta** (अव्यक्त) — `tarka` value: indeterminate — neither true nor false. Catches unresolved, pending, or error states.',
  [TokenKind.ITI]:        '**iti** (इति) — Named close marker (Pāṇinian). `} iti block-name` closes a block and names it, making deep nesting explicit. Validated: the name must match the opening block name.',
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function extractPos(msg: string): { line: number; character: number } | null {
  const m = msg.match(/\[(\d+):(\d+)\]/)
  if (!m) return null
  return { line: parseInt(m[1]) - 1, character: parseInt(m[2]) - 1 }
}

function docRange(doc: TextDocument, line: number, character: number): Range {
  const lineText = doc.getText({
    start: { line, character: 0 },
    end:   { line, character: 1000 },
  })
  return {
    start: { line, character },
    end:   { line, character: character + (lineText.trim().length || 1) },
  }
}

function lineRange(doc: TextDocument, line: number): Range {
  return {
    start: { line, character: 0 },
    end:   { line, character: doc.getText().split('\n')[line]?.length ?? 0 },
  }
}

// ─── Start ───────────────────────────────────────────────────────────────────

documents.listen(connection)
connection.listen()
