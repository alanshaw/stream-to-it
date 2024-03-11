import { Duplex } from 'node:stream'
import { expect } from 'aegir/chai'
import all from 'it-all'
import { pipe } from 'it-pipe'
import Fifo from 'p-fifo'
import * as toIterable from '../src/index.js'
import { randomInt, randomBytes } from './helpers/random.js'

describe('duplex', () => {
  it('should convert to duplex iterable', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const fifo = new Fifo()

    const output = await pipe(
      input,
      toIterable.duplex(new Duplex({
        objectMode: true,
        write (chunk, enc, cb) {
          void fifo.push(chunk).then(() => { cb() })
        },
        final (cb) {
          void fifo.push(null).then(() => { cb() })
        },
        async read (size) {
          while (true) {
            const chunk = await fifo.shift()
            if (!this.push(chunk)) break
          }
        }
      })),
      async (source) => all(source)
    )

    expect(output).to.deep.equal(input)
  })
})
