import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { computeIntervalMs, SUPPORTED_UNITS } from '../src/scheduler.js'

function check(src: string) { return typecheck(parse(src)) }

// ─── computeIntervalMs ────────────────────────────────────────────────────────

describe('computeIntervalMs — unit conversion', () => {
  it('milliseconds', () => {
    expect(computeIntervalMs(1,    'ms')).toBe(1)
    expect(computeIntervalMs(100,  'millisecond')).toBe(100)
    expect(computeIntervalMs(500,  'milliseconds')).toBe(500)
  })

  it('seconds', () => {
    expect(computeIntervalMs(1,  'second')).toBe(1_000)
    expect(computeIntervalMs(30, 'seconds')).toBe(30_000)
    expect(computeIntervalMs(5,  's')).toBe(5_000)
    expect(computeIntervalMs(1,  'sel')).toBe(1_000)
  })

  it('minutes', () => {
    expect(computeIntervalMs(1,  'minute')).toBe(60_000)
    expect(computeIntervalMs(5,  'minutes')).toBe(300_000)
    expect(computeIntervalMs(10, 'min')).toBe(600_000)
  })

  it('hours', () => {
    expect(computeIntervalMs(1, 'hour')).toBe(3_600_000)
    expect(computeIntervalMs(2, 'hours')).toBe(7_200_000)
    expect(computeIntervalMs(6, 'h')).toBe(21_600_000)
    expect(computeIntervalMs(1, 'ghanta')).toBe(3_600_000)
  })

  it('days', () => {
    expect(computeIntervalMs(1,  'day')).toBe(86_400_000)
    expect(computeIntervalMs(7,  'days')).toBe(604_800_000)
    expect(computeIntervalMs(30, 'd')).toBe(2_592_000_000)
    expect(computeIntervalMs(1,  'dina')).toBe(86_400_000)
  })

  it('weeks', () => {
    expect(computeIntervalMs(1, 'week')).toBe(604_800_000)
    expect(computeIntervalMs(2, 'weeks')).toBe(1_209_600_000)
    expect(computeIntervalMs(1, 'w')).toBe(604_800_000)
    expect(computeIntervalMs(1, 'saptaha')).toBe(604_800_000)
  })

  it('unit matching is case-insensitive', () => {
    expect(computeIntervalMs(1, 'Second')).toBe(1_000)
    expect(computeIntervalMs(1, 'MINUTE')).toBe(60_000)
    expect(computeIntervalMs(1, 'Day')).toBe(86_400_000)
  })

  it('rejects unknown unit with clear message', () => {
    expect(() => computeIntervalMs(1, 'antara')).toThrow(/unrecognised unit 'antara'/)
    expect(() => computeIntervalMs(1, 'batch')).toThrow(/unrecognised unit 'batch'/)
    expect(() => computeIntervalMs(5, 'requests')).toThrow(/unrecognised unit 'requests'/)
  })

  it('error message for unknown unit lists supported units', () => {
    try {
      computeIntervalMs(1, 'zap')
    } catch (e) {
      const msg = String(e)
      expect(msg).toContain('supported:')
      for (const u of ['second', 'minute', 'hour', 'day', 'week']) {
        expect(msg).toContain(u)
      }
    }
  })

  it('rejects zero quantity', () => {
    expect(() => computeIntervalMs(0, 'second')).toThrow(/quantity must be positive/)
  })

  it('rejects negative quantity', () => {
    expect(() => computeIntervalMs(-5, 'minute')).toThrow(/quantity must be positive/)
  })

  it('SUPPORTED_UNITS exported and non-empty', () => {
    expect(SUPPORTED_UNITS.length).toBeGreaterThan(0)
    expect(SUPPORTED_UNITS).toContain('second')
    expect(SUPPORTED_UNITS).toContain('minute')
    expect(SUPPORTED_UNITS).toContain('day')
  })
})

// ─── Typechecker — hetu in ghatana ───────────────────────────────────────────

describe('scheduler — ghatana hetu parsing', () => {
  it('parses hetu quantity and unit', () => {
    const file = check(`
      smriti daily-report {
        ghatana {
          hetu: prati 1 day
        }
        pravah { svasti }
      }
    `)
    const decl = file.decls[0]
    if (decl.kind !== 'smriti') throw new Error('expected smriti')
    expect(decl.trigger?.hetu?.quantity).toBe(1)
    expect(decl.trigger?.hetu?.unit).toBe('day')
  })

  it('parses hetu with larger quantities', () => {
    const file = check(`
      smriti periodic {
        ghatana {
          hetu: prati 30 minutes
        }
        pravah { svasti }
      }
    `)
    const decl = file.decls[0]
    if (decl.kind !== 'smriti') throw new Error('expected smriti')
    expect(decl.trigger?.hetu?.quantity).toBe(30)
    expect(decl.trigger?.hetu?.unit).toBe('minutes')
  })

  it('smriti without ghatana has no trigger', () => {
    const file = check(`smriti bare { pravah { svasti } }`)
    const decl = file.decls[0]
    if (decl.kind !== 'smriti') throw new Error('expected smriti')
    expect(decl.trigger).toBeUndefined()
  })

  it('ghatana without hetu has no schedule', () => {
    const file = check(`
      smriti event-driven {
        ghatana {
          vrtti: satya
        }
        pravah { svasti }
      }
    `)
    const decl = file.decls[0]
    if (decl.kind !== 'smriti') throw new Error('expected smriti')
    expect(decl.trigger?.hetu).toBeUndefined()
  })

  it('hetu and vrtti can coexist in ghatana', () => {
    const file = check(`
      smriti conditional-schedule {
        aagama: enabled (tarka)
        ghatana {
          vrtti: enabled
          hetu: prati 5 minutes
        }
        pravah { svasti }
      }
    `)
    const decl = file.decls[0]
    if (decl.kind !== 'smriti') throw new Error('expected smriti')
    expect(decl.trigger?.hetu?.quantity).toBe(5)
    expect(decl.trigger?.vrtti).toBeDefined()
  })
})

// ─── computeIntervalMs matches hetu values ───────────────────────────────────

describe('scheduler — interval from hetu', () => {
  it('computes correct interval for hetu prati 30 minutes', () => {
    expect(computeIntervalMs(30, 'minutes')).toBe(1_800_000)
  })

  it('computes correct interval for hetu prati 1 hour', () => {
    expect(computeIntervalMs(1, 'hour')).toBe(3_600_000)
  })

  it('computes correct interval for hetu prati 7 days', () => {
    expect(computeIntervalMs(7, 'days')).toBe(604_800_000)
  })

  it('rejects antara (duration type used as unit) with clear error', () => {
    // antara is a valid Smriti type but not a scheduling unit — force users to pick a real unit
    expect(() => computeIntervalMs(1, 'antara')).toThrow(/unrecognised unit/)
  })
})
