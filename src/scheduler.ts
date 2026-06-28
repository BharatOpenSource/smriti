// Unit aliases → milliseconds multiplier. Unit strings are lowercase-matched.
const UNIT_MS: Record<string, number> = {
  ms: 1,
  millisecond: 1,
  milliseconds: 1,

  s: 1_000,
  second: 1_000,
  seconds: 1_000,
  sel: 1_000,         // Sanskrit approximation (kshanam is too short; sel is informal)

  min: 60_000,
  minute: 60_000,
  minutes: 60_000,

  h: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  ghanta: 3_600_000,  // Sanskrit: घण्टा

  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  dina: 86_400_000,   // Sanskrit: दिन

  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
  saptaha: 604_800_000, // Sanskrit: सप्ताह
}

export const SUPPORTED_UNITS = Object.keys(UNIT_MS).filter(k => !['ms', 's', 'h', 'd', 'w', 'sel', 'ghanta', 'dina', 'saptaha'].includes(k))

/**
 * Converts a hetu schedule quantity + unit into milliseconds.
 * Throws if the unit is unrecognised.
 */
export function computeIntervalMs(quantity: number, unit: string): number {
  const multiplier = UNIT_MS[unit.toLowerCase()]
  if (multiplier === undefined) {
    throw new Error(
      `smr schedule: unrecognised unit '${unit}' — supported: ${SUPPORTED_UNITS.join(', ')}`,
    )
  }
  if (quantity <= 0) {
    throw new Error(`smr schedule: hetu quantity must be positive (got ${quantity})`)
  }
  return quantity * multiplier
}
