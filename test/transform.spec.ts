import { expect } from 'aegir/chai'
import { Transform } from 'node:stream'
import all from 'it-all'
import { pipe } from 'it-pipe'
import bl from 'bl'
import * as toIterable from '../src/index.js'
import { randomInt, randomBytes } from './helpers/random.js'

describe('transform', () => {
  it('should convert to transform iterable', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const suffix = Buffer.from(`${Date.now()}`)

    const output = await pipe(
      input,
      // Transform every chunk to have a "suffix"
      toIterable.transform<Uint8Array>(new Transform({
        transform (chunk, enc, cb) {
          cb(null, Buffer.concat([chunk, suffix]))
        }
      })),
      async (source) => all(source)
    )

    expect(
      bl(input.map(d => Buffer.concat([d, suffix]))).slice()
    ).to.deep.equal(
      bl(output).slice()
    )
  })

  it('should transform single chunk into multiple chunks', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const separator = Buffer.from(`${Date.now()}`)

    const output = await pipe(
      input,
      // Transform every chunk to have a "suffix"
      toIterable.transform<Uint8Array>(new Transform({
        transform (chunk, enc, cb) {
          this.push(chunk)
          setTimeout(() => {
            this.push(separator)
            cb()
          })
        }
      })),
      async (source) => all(source)
    )

    expect(
      bl(input.map(d => Buffer.concat([d, separator]))).slice()
    ).to.deep.equal(
      bl(output).slice()
    )
  })

  it('should transform single chunk into no chunks', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const output = await pipe(
      input,
      toIterable.transform(new Transform({
        transform (chunk, enc, cb) {
          cb()
        }
      })),
      async (source) => all(source)
    )

    expect(output).to.have.lengthOf(0)
  })

  it('should error the iterator when transform stream errors', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    let i = 0

    await expect(
      pipe(
        input,
        toIterable.transform(new Transform({
          transform (chunk, enc, cb) {
            i++
            if (i > 2) return cb(new Error('boom'))
            cb(null, chunk)
          }
        })),
        async (source) => all(source)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')
  })

  it('should destroy transform stream and pass through errors from source', async () => {
    async function * input () {
      yield 'hello,'
      yield 'world,'
      throw new Error('test error')
    }

    const transformStream = new Transform({
      transform (chunk, enc, cb) {
        cb(null, chunk)
      }
    })

    await expect(
      pipe(
        input,
        toIterable.transform(transformStream),
        async (source) => all(source)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'test error')

    expect(transformStream).to.have.property('destroyed').that.is.true()
  })
})
