import { describe, it, expect } from 'vitest'
import { parse } from '../src/parser.js'
import { typecheck } from '../src/typechecker.js'

const valid = (src: string) => typecheck(parse(src))
const errors = (src: string) => {
  try { typecheck(parse(src)); return '' }
  catch (e) { return String(e) }
}

const VALID = `
smriti test-process {
  paksha applicant { bhumika: citizen adhikara: submit }
  paksha office    { bhumika: officer adhikara: approve }

  pravah {
    pada submit {
      karta: applicant
      kaarya: "Submit"
      nirgama: result (tarka)
    }
    vibhaga result {
      niyama satya    → svasti
      niyama asatya   → anaapta
      niyama avyakta  → anaapta
    }
  }
}
`

describe('typechecker', () => {
  it('accepts a valid smriti file', () => {
    expect(() => valid(VALID)).not.toThrow()
  })

  it('rejects an undefined branch target', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one { kaarya: "first" nirgama: ok (tarka) }
    vibhaga ok {
      niyama satya   → does-not-exist
      niyama asatya  → anaapta
      niyama avyakta → anaapta
    }
  }
}
`
    expect(errors(src)).toMatch(/does-not-exist/)
  })

  it('rejects duplicate step names', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one { kaarya: "first" }
    pada step-one { kaarya: "duplicate" }
    svasti
  }
}
`
    expect(errors(src)).toMatch(/Duplicate step name 'step-one'/)
  })

  it('rejects karta that is not a declared paksha', () => {
    const src = `
smriti bad {
  paksha officer { bhumika: reviewer adhikara: review }
  pravah {
    pada review-step {
      karta: unknown-actor
      kaarya: "Do something"
    }
    svasti
  }
}
`
    expect(errors(src)).toMatch(/unknown-actor/)
    expect(errors(src)).toMatch(/not a declared paksha/)
  })

  it('rejects prativritti to a non-existent step', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one {
      kaarya: "do"
      prativritti: ghost-step
    }
    svasti
  }
}
`
    expect(errors(src)).toMatch(/ghost-step/)
    expect(errors(src)).toMatch(/does not exist/)
  })

  it('rejects a tarka vibhaga missing cases', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one { nirgama: result (tarka) }
    vibhaga result {
      niyama satya  → svasti
      niyama asatya → anaapta
    }
  }
}
`
    expect(errors(src)).toMatch(/avyakta/)
    expect(errors(src)).toMatch(/missing cases/)
  })

  it('rejects duplicate field names in aagama', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one {
      aagama: doc (patra), doc (vakya)
    }
    svasti
  }
}
`
    expect(errors(src)).toMatch(/Duplicate field name 'doc'/)
  })

  it('rejects a kosa with a collection key type', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one {
      nirgama: result (kosa[krama[vakya], sankhya])
    }
    svasti
  }
}
`
    expect(errors(src)).toMatch(/kosa key type must be a scalar/)
  })

  it('accepts correct iti names on all block types', () => {
    const src = `
smriti test-iti {
  paksha applicant { bhumika: citizen adhikara: submit } iti applicant
  pravah {
    pada submit {
      karta: applicant
      nirgama: result (tarka)
    } iti submit
    vibhaga result {
      niyama satya    → svasti
      niyama asatya   → anaapta
      niyama avyakta  → anaapta
    } iti result
  }
} iti test-iti
`
    expect(() => valid(src)).not.toThrow()
  })

  it('rejects iti name that does not match block name', () => {
    const src = `
smriti my-process {
  pravah {
    pada step { karta: actor }
    svasti
  }
} iti wrong-name
`
    expect(errors(src)).toMatch(/iti name 'wrong-name' does not match block name 'my-process'/)
  })

  it('rejects iti name mismatch on a pada', () => {
    const src = `
smriti test {
  pravah {
    pada submit { karta: actor } iti verify
    svasti
  }
}
`
    expect(errors(src)).toMatch(/iti name 'verify' does not match block name 'submit'/)
  })

  it('collects all errors before throwing', () => {
    const src = `
smriti bad {
  pravah {
    pada step-one { kaarya: "first" }
    pada step-one { kaarya: "dup" }
    vibhaga result {
      niyama satya → ghost
      niyama asatya → anaapta
      niyama avyakta → anaapta
    }
  }
}
`
    const msg = errors(src)
    expect(msg).toMatch(/Duplicate step name/)
    expect(msg).toMatch(/ghost/)
  })
})
