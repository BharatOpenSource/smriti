// Display script support for SVG rendering.
// 'latin' — IAST/English labels (default)
// 'devanagari' — Sanskrit labels in Devanagari script

export type Script = 'latin' | 'devanagari'

export interface Labels {
  actor:      string  // label before karta value
  inputs:     string  // label before aagama fields
  outputs:    string  // label before nirgama fields
  sla:        string  // label before samaya value
  fail:       string  // label for apavaada route
  timeout:    string  // label for samapti route
  completed:  string  // svasti terminal text
  rejected:   string  // anaapta terminal text
  branch:     string  // vibhaga box prefix
  valueOffset: number // px gap between label and value in metaLine
  fontFamily: string  // SVG font-family attribute
}

export const LATIN_LABELS: Labels = {
  actor:      'Actor:',
  inputs:     'In:',
  outputs:    'Out:',
  sla:        'SLA:',
  fail:       '⚠ fail →',
  timeout:    '⏱ timeout →',
  completed:  '✓  Completed',
  rejected:   '✗  Rejected',
  branch:     'branch:',
  valueOffset: 48,
  fontFamily: "'Segoe UI', system-ui, sans-serif",
}

export const DEVANAGARI_LABELS: Labels = {
  actor:      'कर्ता:',
  inputs:     'आगम:',
  outputs:    'निर्गम:',
  sla:        'समय:',
  fail:       '⚠ अपवाद →',
  timeout:    '⏱ समाप्ति →',
  completed:  '✓  स्वस्ति',
  rejected:   '✗  अनाप्त',
  branch:     'विभाग:',
  valueOffset: 80,
  fontFamily: "'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', 'Devanagari MT', system-ui, sans-serif",
}

export function labelsFor(script: Script): Labels {
  return script === 'devanagari' ? DEVANAGARI_LABELS : LATIN_LABELS
}
