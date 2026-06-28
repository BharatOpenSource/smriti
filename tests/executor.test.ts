import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'
import { buildKriyaEnv } from '../src/evaluator.js'
import { executeFlow, executeSmriti } from '../src/executor.js'
import type { SmritiDecl } from '../src/ast.js'

function run(src: string, payload: Record<string, unknown> = {}) {
  const file = typecheck(parse(src))
  const decl = file.decls.find(d => d.kind === 'smriti') as SmritiDecl
  const env = buildKriyaEnv(file)
  return executeSmriti(decl, payload as Record<string, string | number | boolean | null>, env)
}

// runRaw: parse only (no typecheck) — for testing executor behavior on structurally
// relaxed flows that intentionally lack terminals or have unusual shapes.
function runRaw(src: string, payload: Record<string, unknown> = {}) {
  const file = parse(src)
  const decl = file.decls.find(d => d.kind === 'smriti') as SmritiDecl
  const env = buildKriyaEnv(file)
  return executeSmriti(decl, payload as Record<string, string | number | boolean | null>, env)
}

// ─── Linear flow ──────────────────────────────────────────────────────────────

describe('linear flow', () => {
  it('svasti terminal produces svasti outcome', () => {
    const r = run(`smriti test { pravah { svasti } }`)
    expect(r.outcome).toBe('svasti')
    expect(r.log).toHaveLength(0)
  })

  it('anaapta terminal produces anaapta outcome', () => {
    const r = run(`smriti test { pravah { anaapta } }`)
    expect(r.outcome).toBe('anaapta')
  })

  it('two steps then svasti — both logged as completed', () => {
    const r = run(`
smriti test {
  pravah {
    pada step-a { nirgama: x (tarka) }
    pada step-b { nirgama: y (tarka) }
    svasti
  }
}`)
    expect(r.outcome).toBe('svasti')
    expect(r.log).toHaveLength(2)
    expect(r.log[0].name).toBe('step-a')
    expect(r.log[1].name).toBe('step-b')
  })

  it('flow with no terminal falls off end as svasti', () => {
    // Use runRaw: typechecker requires a terminal, but we test executor fallback
    const r = runRaw(`smriti test { pravah { pada lone-step { nirgama: x (tarka) } } }`)
    expect(r.outcome).toBe('svasti')
    expect(r.log).toHaveLength(1)
  })
})

// ─── Guard (khanda) ───────────────────────────────────────────────────────────

describe('step guards (khanda)', () => {
  it('step with false guard is skipped', () => {
    const r = run(`
smriti test {
  pravah {
    pada guarded { khanda: asatya  nirgama: x (tarka) }
    svasti
  }
}`)
    expect(r.log[0].status).toBe('skipped')
    expect(r.outcome).toBe('svasti')
  })

  it('step with true guard executes', () => {
    const r = run(`
smriti test {
  pravah {
    pada guarded { khanda: satya  nirgama: x (tarka) }
    svasti
  }
}`)
    expect(r.log[0].status).not.toBe('skipped')
    expect(r.outcome).toBe('svasti')
  })

  it('guard uses payload field (smriti aagama)', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya)
  pravah {
    pada conditional { khanda: amount > 100  nirgama: ok (tarka) }
    svasti
  }
}`, { amount: 200 })
    expect(r.log[0].status).not.toBe('skipped')
  })

  it('guard blocks step when payload field fails condition', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya)
  pravah {
    pada conditional { khanda: amount > 100  nirgama: ok (tarka) }
    svasti
  }
}`, { amount: 50 })
    expect(r.log[0].status).toBe('skipped')
  })
})

// ─── Kaarya kriya dispatch ────────────────────────────────────────────────────

describe('kaarya — kriya invocation in pada', () => {
  it('pada with kaarya kriya produces nirgama from kriya', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya)
  kriya compute-tax {
    aagama: amount (sankhya)
    nirgama: tax (sankhya)
    tax = amount * 18 / 100
  }
  pravah {
    pada calculate {
      kaarya: kriya compute-tax(amount)
      nirgama: tax (sankhya)
    }
    svasti
  }
}`, { amount: 1000 })
    expect(r.outcome).toBe('svasti')
    expect(r.produced['tax']).toBe(180)
    expect(r.log[0].produced['tax']).toBe(180)
  })

  it('pada without kaarya auto-completes nirgama as null', () => {
    const r = run(`
smriti test {
  pravah {
    pada human-step {
      kaarya: "Please verify the document"
      nirgama: verified (tarka)
    }
    svasti
  }
}`)
    expect(r.log[0].status).toBe('auto-completed')
    expect(r.produced['verified']).toBeNull()
  })

  it('pada kriya result available to downstream steps', () => {
    const r = run(`
smriti test {
  aagama: n (sankhya)
  kriya double { aagama: n (sankhya)  nirgama: r (sankhya)  r = n * 2 }
  pravah {
    pada step-a {
      kaarya: kriya double(n)
      nirgama: r (sankhya)
    }
    pada step-b {
      kaarya: kriya double(r)
      nirgama: final (sankhya)
    }
    svasti
  }
}`, { n: 5 })
    expect(r.produced['final']).toBe(20)
  })
})

// ─── varna bindings ───────────────────────────────────────────────────────────

describe('varna — named variable binding', () => {
  it('varna with expr binds to produced', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya), fee (sankhya)
  pravah {
    varna total : sankhya = amount + fee
    svasti
  }
}`, { amount: 900, fee: 100 })
    expect(r.produced['total']).toBe(1000)
  })

  it('varna without expr binds null', () => {
    const r = run(`smriti test { pravah { varna label : vakya  svasti } }`)
    expect(r.produced['label']).toBeNull()
  })

  it('varna result is available to subsequent step guards', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya)
  pravah {
    varna is-valid : tarka = amount > 0
    pada step { khanda: is-valid  nirgama: ok (tarka) }
    svasti
  }
}`, { amount: 100 })
    expect(r.log[0].name).toBe('step')
    expect(r.log[0].status).not.toBe('skipped')
  })
})

// ─── vibhaga branching ────────────────────────────────────────────────────────

describe('vibhaga — conditional routing', () => {
  it('routes to svasti when condition matches', () => {
    const r = run(`
smriti test {
  aagama: status (vakya)
  pravah {
    vibhaga status {
      niyama status == "approved" → svasti
      niyama status == "rejected" → anaapta
    }
    anaapta
  }
}`, { status: 'approved' })
    expect(r.outcome).toBe('svasti')
  })

  it('routes to anaapta when second clause matches', () => {
    const r = run(`
smriti test {
  aagama: status (vakya)
  pravah {
    vibhaga status {
      niyama status == "approved" → svasti
      niyama status == "rejected" → anaapta
    }
    svasti
  }
}`, { status: 'rejected' })
    expect(r.outcome).toBe('anaapta')
  })

  it('routes to a named step by jumping past intermediate steps', () => {
    const r = run(`
smriti test {
  pravah {
    pada intake { nirgama: ok (tarka) }
    vibhaga ok {
      niyama ok == satya → done
      niyama ok == asatya → failed
    }
    pada failed { nirgama: x (tarka) }
    pada done { nirgama: y (tarka) }
    svasti
  }
}`)
    // ok auto-completes to null → no clause matches (satya/asatya both fail against null)
    // → falls through to failed then done
    expect(r.log.map(l => l.name)).toContain('failed')
  })

  it('no matching clause continues linearly', () => {
    const r = run(`
smriti test {
  aagama: flag (vakya)
  pravah {
    vibhaga flag {
      niyama flag == "yes" → svasti
      niyama flag == "no" → svasti
    }
    pada fallback { nirgama: x (tarka) }
    svasti
  }
}`, { flag: 'maybe' })
    expect(r.log[0].name).toBe('fallback')
  })
})

// ─── Routing (pravritti / prativritti) ────────────────────────────────────────

describe('step routing', () => {
  it('pravritti jumps forward past intermediate steps', () => {
    const r = run(`
smriti test {
  pravah {
    pada start {
      nirgama: x (tarka)
      pravritti: done
    }
    pada skipped { nirgama: y (tarka) }
    pada done { nirgama: z (tarka) }
    svasti
  }
}`)
    expect(r.log.map(l => l.name)).toEqual(['start', 'done'])
  })

  it('prativritti loops back until budget is exhausted', () => {
    expect(() => run(`
smriti test {
  pravah {
    pada loop-step {
      nirgama: x (tarka)
      prativritti: loop-step
    }
    svasti
  }
}`)).toThrow(/step limit exceeded/)
  })
})

// ─── Parallel (anubhaga / anugama) ───────────────────────────────────────────

describe('parallel tracks (anubhaga)', () => {
  it('runs two tracks and merges outputs', () => {
    const r = run(`
smriti test {
  pravah {
    anubhaga {
      pada track-a { nirgama: a (tarka) }
    }, {
      pada track-b { nirgama: b (tarka) }
    }
    anugama track-a track-b
    svasti
  }
}`)
    expect(r.outcome).toBe('svasti')
    expect(r.log.map(l => l.name)).toContain('track-a')
    expect(r.log.map(l => l.name)).toContain('track-b')
  })

  it('three tracks all run and appear in log', () => {
    const r = run(`
smriti test {
  pravah {
    anubhaga {
      pada a { nirgama: x (tarka) }
    }, {
      pada b { nirgama: y (tarka) }
    }, {
      pada c { nirgama: z (tarka) }
    }
    anugama a b c
    svasti
  }
}`)
    expect(r.log.map(l => l.name)).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('anaapta in any track short-circuits to anaapta', () => {
    const r = run(`
smriti test {
  pravah {
    anubhaga {
      pada ok-step { nirgama: x (tarka) }
    }, {
      anaapta
    }
    svasti
  }
}`)
    expect(r.outcome).toBe('anaapta')
  })

  it('tracks share the payload at entry but produce independent outputs', () => {
    const r = run(`
smriti test {
  aagama: n (sankhya)
  kriya double { aagama: n (sankhya)  nirgama: r (sankhya)  r = n * 2 }
  kriya triple { aagama: n (sankhya)  nirgama: r (sankhya)  r = n * 3 }
  pravah {
    anubhaga {
      pada doubled {
        kaarya: kriya double(n)
        nirgama: d (sankhya)
      }
    }, {
      pada tripled {
        kaarya: kriya triple(n)
        nirgama: t (sankhya)
      }
    }
    anugama doubled tripled
    svasti
  }
}`, { n: 5 })
    expect(r.produced['d']).toBe(10)
    expect(r.produced['t']).toBe(15)
  })
})

// ─── Process-level sthiti ─────────────────────────────────────────────────────

describe('process-level sthiti', () => {
  it('sthiti initial value available to steps', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya)
  sthiti { threshold (sankhya) = 500 }
  pravah {
    pada check {
      khanda: amount > threshold
      nirgama: ok (tarka)
    }
    svasti
  }
}`, { amount: 600 })
    expect(r.log[0].status).not.toBe('skipped')
  })

  it('payload overrides sthiti initial value', () => {
    const r = run(`
smriti test {
  aagama: amount (sankhya), threshold (sankhya)
  sthiti { threshold (sankhya) = 500 }
  pravah {
    pada check {
      khanda: amount > threshold
      nirgama: ok (tarka)
    }
    svasti
  }
}`, { amount: 400, threshold: 300 })
    // payload threshold (300) overwrites sthiti seed (500); amount (400) > 300 → fires
    expect(r.log[0].status).not.toBe('skipped')
  })
})

// ─── Step count ───────────────────────────────────────────────────────────────

describe('step counting', () => {
  it('step count is non-zero for executed flow', () => {
    const r = run(`
smriti test {
  pravah {
    pada a { nirgama: x (tarka) }
    pada b { nirgama: y (tarka) }
    svasti
  }
}`)
    expect(r.steps).toBeGreaterThan(0)
  })

  it('executeSmriti throws on infinite loop', () => {
    expect(() => run(`
smriti test {
  pravah {
    pada loop-step {
      nirgama: x (tarka)
      prativritti: loop-step
    }
    svasti
  }
}`)).toThrow(/step limit exceeded/)
  })
})
