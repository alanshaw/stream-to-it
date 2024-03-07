import Crypto from 'node:crypto'

/**
 * Maximum is exclusive and the minimum is inclusive
 */
export function randomInt (min: number, max: number): number {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min)) + min
}

export function randomBytes (min: number, max: number) {
  return Crypto.randomBytes(randomInt(min, max))
}
