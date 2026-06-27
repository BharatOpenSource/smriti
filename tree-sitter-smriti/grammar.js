// Tree-sitter grammar for the Smriti language (.smr files).
// Mirrors spec/grammar.ebnf v0.3.
//
// Generate the C parser:   npx tree-sitter generate
// Test against a file:     npx tree-sitter parse examples/sample.smr
// Highlight locally:       npx tree-sitter highlight examples/sample.smr

module.exports = grammar({
  name: 'smriti',

  // Identifies which terminal is the "word" — used for keyword extraction.
  // Any string matching identifier that also matches a keyword string literal
  // is treated as that keyword (not as an identifier).
  word: $ => $.identifier,

  extras: $ => [
    /\s+/,
    $.comment,
  ],

  rules: {

    // ─── Top level ──────────────────────────────────────────────────────────

    source_file: $ => repeat(
      choice($.smriti_decl, $.sutra_decl)
    ),

    smriti_decl: $ => seq(
      'smriti',
      field('name', $.identifier),
      '{',
      optional($.smriti_body),
      '}',
      optional($.iti),
    ),

    sutra_decl: $ => seq(
      'sutra',
      field('name', $.identifier),
      optional($.anuvrtti),
      '{',
      optional($.sutra_body),
      '}',
      optional($.iti),
    ),

    anuvrtti: $ => seq('anuvrtti', field('parent', $.name_ref)),

    iti: $ => seq('iti', field('label', $.identifier)),

    // ─── Bodies ─────────────────────────────────────────────────────────────
    // Permissive ordering — tree-sitter is used during editing (incremental),
    // so strict ordering would cause parse errors on in-progress files.

    smriti_body: $ => repeat1(choice(
      $.metadata,
      $.aagama_decl,
      $.nirgama_decl,
      $.reference,
      $.participant,
      $.trigger,
      $.flow,
    )),

    sutra_body: $ => repeat1(choice(
      $.metadata,
      $.aagama_decl,
      $.nirgama_decl,
      $.flow,
    )),

    // ─── Metadata ───────────────────────────────────────────────────────────

    metadata: $ => choice(
      $.adhipati_decl,
      $.aavartana_decl,
      $.stara_decl,
      $.prabhaava_decl,
      $.sthala_decl,
      $.kshetra_decl,
      $.avadhi_decl,
    ),

    adhipati_decl:  $ => seq('adhipati',  ':', $.string),
    aavartana_decl: $ => seq('aavartana', ':', $.version),
    stara_decl:     $ => seq('stara',     ':', choice('public', 'restricted', 'private')),
    prabhaava_decl: $ => seq('prabhaava', ':', $.date),
    sthala_decl:    $ => seq('sthala',    ':', $.string),
    kshetra_decl:   $ => seq('kshetra',   ':', $.string),
    avadhi_decl:    $ => seq('avadhi',    ':', $.number, 'antara'),

    // ─── References ─────────────────────────────────────────────────────────

    reference: $ => choice($.sangama_decl, $.lagna_decl),

    sangama_decl: $ => seq(
      'sangama',
      field('name', $.identifier),
      '{',
      seq('yuja', ':', $.string),
      '}',
      optional($.iti),
    ),

    lagna_decl: $ => seq(
      'lagna',
      field('name', $.identifier),
      '{',
      seq('yuja', ':', $.string),
      optional(seq('adhipati',  ':', $.string)),
      optional(seq('aavartana', ':', $.version)),
      '}',
      optional($.iti),
    ),

    // ─── Participants ────────────────────────────────────────────────────────

    participant: $ => seq(
      'paksha',
      field('name', $.identifier),
      '{',
      optional($.participant_body),
      '}',
      optional($.iti),
    ),

    participant_body: $ => repeat1(choice(
      $.bhumika_decl,
      $.adhikara_decl,
      $.pramana_decl,
    )),

    bhumika_decl:  $ => seq('bhumika',  ':', $.identifier),
    adhikara_decl: $ => seq('adhikara', ':', $.identifier, repeat(seq(',', $.identifier))),
    pramana_decl:  $ => seq('pramana',  ':', $.string),

    // ─── Trigger ────────────────────────────────────────────────────────────

    trigger: $ => seq(
      'ghatana',
      '{',
      repeat($.trigger_field),
      '}',
      optional($.iti),
    ),

    trigger_field: $ => choice(
      $.vrtti_decl,
      $.hetu_decl,
      $.karta_trigger_decl,
      $.sthala_trigger_decl,
      $.kaarya_trigger_decl,
    ),

    vrtti_decl:        $ => seq('vrtti',  ':', $.expression),
    hetu_decl:         $ => seq('hetu',   ':', 'prati', $.number, $.identifier),
    karta_trigger_decl:  $ => seq('karta',  ':', $.expression),
    sthala_trigger_decl: $ => seq('sthala', ':', $.expression),
    kaarya_trigger_decl: $ => seq('kaarya', ':', $.expression),

    // ─── Flow ───────────────────────────────────────────────────────────────

    flow: $ => seq(
      'pravah',
      '{',
      repeat1($.flow_item),
      '}',
      optional($.iti),
    ),

    flow_item: $ => choice(
      $.pada_decl,
      $.aadesha_decl,
      $.varna_decl,
      $.vibhaga_decl,
      $.anubhaga_decl,
      $.anugama_decl,
      $.aavaha_decl,
      $.sthiti_decl,
      $.svasti,
      $.anaapta,
    ),

    svasti:  _ => 'svasti',
    anaapta: _ => 'anaapta',

    // ─── Step (pada) ────────────────────────────────────────────────────────

    pada_decl: $ => seq(
      'pada',
      field('name', $.identifier),
      '{',
      optional($.pada_body),
      '}',
      optional($.iti),
    ),

    // aadesha: replaces a named parent step's body (Pāṇinian substitute).
    aadesha_decl: $ => seq(
      'aadesha',
      field('target', $.identifier),
      '{',
      optional($.pada_body),
      '}',
    ),

    // varna: named variable / data binding in the flow.
    varna_decl: $ => seq(
      'varna',
      field('name', $.identifier),
      ':',
      field('type', $.type),
      optional(seq('=', $.expression)),
    ),

    // Fields are unordered in the parser; remain permissive here.
    pada_body: $ => repeat1(choice(
      $.karta_decl,
      $.kaarya_decl,
      $.aagama_decl,
      $.nirgama_decl,
      $.samaya_decl,
      $.khanda_decl,
      $.apavaada_decl,
      $.apavaada_data,
      $.samapti_decl,
      $.samapti_data,
      $.routing,
    )),

    karta_decl:   $ => seq('karta',   ':', $.name_ref),
    kaarya_decl:  $ => seq('kaarya',  ':', $.string),
    aagama_decl:  $ => seq('aagama',  ':', $.typed_field, repeat(seq(',', $.typed_field))),
    nirgama_decl: $ => seq('nirgama', ':', $.typed_field, repeat(seq(',', $.typed_field))),
    samaya_decl:  $ => seq('samaya',  ':', $.number, $.time_unit),
    khanda_decl:  $ => seq('khanda',  ':', $.expression),

    // apavaada → target: exception routing
    apavaada_decl: $ => seq('apavaada', $.arrow, $.branch_target),
    // apavaada: fields: error data produced for the exception handler
    apavaada_data: $ => seq('apavaada', ':', $.typed_field, repeat(seq(',', $.typed_field))),

    // samapti → target: SLA timeout routing (requires samaya)
    samapti_decl:  $ => seq('samapti',  $.arrow, $.branch_target),
    // samapti: fields: timeout data produced for the timeout handler
    samapti_data:  $ => seq('samapti',  ':', $.typed_field, repeat(seq(',', $.typed_field))),

    routing: $ => choice($.pravritti_decl, $.prativritti_decl),
    pravritti_decl:   $ => seq('pravritti',   ':', $.identifier),
    prativritti_decl: $ => seq('prativritti', ':', $.identifier),

    // ─── Branching ──────────────────────────────────────────────────────────

    vibhaga_decl: $ => seq(
      'vibhaga',
      field('on', $.identifier),
      '{',
      repeat1($.niyama_clause),
      '}',
      optional($.iti),
    ),

    niyama_clause: $ => seq('niyama', $.expression, $.arrow, $.branch_target),

    branch_target: $ => choice($.identifier, $.svasti, $.anaapta),

    // ─── Parallel ───────────────────────────────────────────────────────────

    anubhaga_decl: $ => seq(
      'anubhaga',
      $.parallel_track,
      repeat1(seq(',', $.parallel_track)),
    ),

    parallel_track: $ => seq('{', repeat1($.flow_item), '}'),

    anugama_decl: $ => seq('anugama', repeat1($.identifier)),

    // ─── Sub-process invocation ─────────────────────────────────────────────

    aavaha_decl: $ => seq(
      'aavaha',
      field('target', $.name_ref),
      optional($.aavaha_aagama),
      optional($.aavaha_nirgama),
    ),

    // Named rules so highlights can target aagama/nirgama inside aavaha distinctly.
    aavaha_aagama:  $ => seq('aagama',  ':', $.typed_field, repeat(seq(',', $.typed_field))),
    aavaha_nirgama: $ => seq('nirgama', ':', $.typed_field, repeat(seq(',', $.typed_field))),

    // ─── State ──────────────────────────────────────────────────────────────

    sthiti_decl: $ => seq('sthiti', field('name', $.identifier)),

    // ─── Name reference ─────────────────────────────────────────────────────

    name_ref: $ => choice(
      prec(1, $.qualified_name),
      $.identifier,
    ),

    qualified_name: $ => seq(
      field('namespace', $.identifier),
      '.',
      field('member', $.identifier),
    ),

    // ─── Type system ────────────────────────────────────────────────────────

    typed_field: $ => seq(
      optional('vikalpa'),
      field('field_name', $.identifier),
      '(',
      field('type', $.type),
      ')',
    ),

    type: $ => choice($.scalar_type, $.collection_type),

    scalar_type: $ => choice(
      seq('sankhya', optional($.range_constraint)),
      'bhinnaanka',
      'dashaamsha',
      seq('vakya', optional($.string)),  // optional regex pattern
      'tithi', 'antara', 'tarka', 'patra',
    ),

    // sankhya range: min..max | min.. | ..max
    range_constraint: $ => choice(
      seq($.number, '..', optional($.number)),  // min..max or min..
      seq('..', $.number),                       // ..max
    ),

    collection_type: $ => choice(
      seq('krama', '[', $.type, ']'),
      seq('kosa',  '[', $.type, ',', $.type, ']'),
    ),

    time_unit: _ => 'antara',

    // ─── Expressions ────────────────────────────────────────────────────────
    // Recursive expression grammar matching spec/grammar.ebnf.
    // Precedence (high → low): not, comparison, logical-and, logical-or.

    expression: $ => $._expr,

    _expr: $ => choice(
      $.or_expr,
      $.and_expr,
      $.cmp_expr,
      $.not_expr,
      $.primary,
    ),

    or_expr:  $ => prec.left(1, seq($._expr, '||', $._expr)),
    and_expr: $ => prec.left(2, seq($._expr, '&&', $._expr)),
    cmp_expr: $ => prec.left(3, seq($._expr, $.compare_op, $._expr)),
    not_expr: $ => prec.right(4, seq('!', $._expr)),

    primary: $ => choice(
      $.tarka_value,
      $.number,
      $.string,
      $.identifier,
      seq('(', $.expression, ')'),
    ),

    compare_op: _ => choice('==', '!=', '<', '>', '<=', '>='),

    tarka_value: _ => choice('satya', 'asatya', 'avyakta'),

    // ─── Arrow ──────────────────────────────────────────────────────────────
    // Unicode arrow (U+2192) is canonical; ASCII '->' accepted as alias.

    arrow: _ => choice('→', '->'),

    // ─── Primitives ─────────────────────────────────────────────────────────

    // Longer patterns first so lexer prefers version over number.
    version:    _ => token(prec(2, /[0-9]+\.[0-9]+\.[0-9]+/)),
    date:       _ => token(prec(1, /\d{4}-\d{2}-\d{2}/)),
    number:     _ => /[0-9]+(\.[0-9]+)?/,
    string:     _ => /"[^"\n]*"/,
    identifier: _ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: _ => /#[^\n]*/,
  },
})
