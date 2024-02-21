import { expect } from 'aegir/chai'
import { Readable } from 'node:stream'
import * as toIterable from '../src/index.js'
import all from 'it-all'
import { randomInt, randomBytes } from './helpers/random.js'

describe('source', () => {
  it('should convert to source iterable', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    let i = 0
    const readable = new Readable({
      objectMode: true,
      read () {
        while (true) {
          const data = input[i++] || null
          if (!this.push(data)) break
        }
      }
    })
    const output = await all(toIterable.source(readable))
    expect(output).to.deep.equal(input)
  })

  it('should convert browser ReadableStream to source iterable', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    let i = 0

    const readable = new ReadableStream({
      pull: (controller) => {
        const value = input[i++]

        if (value == null) {
          controller.close()
        } else {
          controller.enqueue(value)
        }
      }
    })

    const output = await all(toIterable.source(readable))
    expect(output).to.deep.equal(input)
  })
})
