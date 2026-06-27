; Syntax highlighting queries for Smriti (.smr files).
; Compatible with Neovim (nvim-treesitter) and GitHub Linguist.
; Highlight group names follow nvim-treesitter conventions.
; Mirrors spec/grammar.ebnf v0.3.

; ─── Structure keywords ────────────────────────────────────────────────────────

[
  "smriti" "sutra" "iti"
  "pravah" "pada" "aadesha"
  "paksha" "sangama" "lagna"
  "ghatana" "anuvrtti"
] @keyword

; ─── Flow control keywords ────────────────────────────────────────────────────

[
  "vibhaga" "niyama"
  "anubhaga" "anugama"
  "aavaha" "sthiti" "varna"
  "apavaada" "samapti"
  "pravritti" "prativritti"
  "prati"
] @keyword.control

; ─── Terminal keywords ────────────────────────────────────────────────────────

(svasti)  @keyword.return
(anaapta) @keyword.exception

; ─── Field declaration keywords ───────────────────────────────────────────────

[
  "karta" "kaarya"
  "aagama" "nirgama"
  "samaya" "khanda"
  "bhumika" "adhikara" "pramana"
  "yuja"
  "vrtti" "hetu"
  "sthala"
  "vikalpa"
] @keyword.operator

; ─── Metadata keywords ────────────────────────────────────────────────────────

[
  "adhipati" "aavartana" "stara"
  "prabhaava" "sthala" "kshetra" "avadhi"
] @attribute

; ─── Types ────────────────────────────────────────────────────────────────────

(scalar_type) @type.builtin

[
  "krama" "kosa"
] @type.builtin

; ─── Tarka / boolean literals ─────────────────────────────────────────────────

(tarka_value) @constant.builtin

; ─── Stara visibility values ──────────────────────────────────────────────────

(stara_decl
  [
    "public" "restricted" "private"
  ] @string.special)

; ─── Named entities (process, step, actor, participant) ───────────────────────

(smriti_decl name: (identifier) @module)
(sutra_decl  name: (identifier) @module)

(pada_decl    name: (identifier)   @function)
(aadesha_decl target: (identifier) @function)
(varna_decl   name: (identifier)   @variable.declaration)
(participant  name: (identifier)   @type)
(sthiti_decl  name: (identifier)   @constant)
(vibhaga_decl on: (identifier)     @variable)
(anuvrtti     parent: (name_ref)   @module)

; iti close marker — label should match the opening name
(iti label: (identifier) @module)

; Qualified names (namespace.process)
(qualified_name
  namespace: (identifier) @module
  member:    (identifier) @function)

; aavaha invocation target
(aavaha_decl target: (name_ref) @function.call)

; karta (actor) reference
(karta_decl (name_ref (identifier) @variable))
(karta_decl (name_ref (qualified_name namespace: (identifier) @module)))

; sangama / lagna namespace bindings
(sangama_decl name: (identifier) @namespace)
(lagna_decl   name: (identifier) @namespace)

; typed field names
(typed_field field_name: (identifier) @property)

; anugama step names (join targets)
(anugama_decl (identifier) @function)

; ─── Operators ────────────────────────────────────────────────────────────────

(arrow) @operator
(compare_op) @operator
["||" "&&"] @operator
["!" "="] @operator
".." @operator

; ─── Literals ─────────────────────────────────────────────────────────────────

(string)  @string
(number)  @number
(version) @number
(date)    @string.special

; ─── Comments ─────────────────────────────────────────────────────────────────

(comment) @comment

; ─── Punctuation ──────────────────────────────────────────────────────────────

["(" ")" "{" "}" "[" "]"] @punctuation.bracket
["," ":"] @punctuation.delimiter
