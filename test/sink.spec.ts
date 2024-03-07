import { expect } from 'aegir/chai'
import { Writable } from 'node:stream'
import * as toIterable from '../src/index.js'
import { pipe } from 'it-pipe'
import { randomInt, randomBytes } from './helpers/random.js'
import delay from 'delay'

const slowIterator = async function * (values: Uint8Array[]) {
  for (const value of values) {
    await delay(1)
    yield value
  }
}

describe('sink', () => {
  it('should convert to sink iterable', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output: number[] = []

    await pipe(
      input,
      toIterable.sink(new Writable({
        write (chunk, enc, cb) {
          output.push(chunk)
          cb()
        }
      }))
    )

    expect(output).to.deep.equal(input)
  })

  it('should convert to sink iterable and call return on end', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    let i = 0
    let returnCalled = false
    const output: number[] = []

    const iter: any = {
      [Symbol.iterator] () {
        return this
      },
      next () {
        const value = input[i++]
        return { done: !value, value }
      },
      return () {
        returnCalled = true
      }
    }

    await pipe(
      iter,
      toIterable.sink(new Writable({
        write (chunk, enc, cb) {
          output.push(chunk)
          cb()
        }
      }))
    )

    expect(returnCalled).to.be.true()
    expect(output).to.deep.equal(input)
  })

  it('should end mid stream', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output: number[] = []

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
        this.end()
      }
    })

    await pipe(
      input,
      toIterable.sink(stream)
    )

    expect(output).to.deep.equal(input.slice(0, 1))
    expect(stream.destroyed).to.be.false()
    expect(stream.writable).to.be.false()
  })

  it('should destroy mid stream', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output: number[] = []

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
        this.destroy()
      }
    })

    await pipe(
      input,
      toIterable.sink(stream)
    )

    expect(output).to.deep.equal(input.slice(0, 1))
    expect(stream.destroyed).to.be.true()
    expect(stream.writable).to.be.false()
  })

  it('should destroy mid stream with error', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output = []

    await expect(
      pipe(
        input,
        toIterable.sink(new Writable({
          write (chunk, enc, cb) {
            output.push(chunk)
            cb()
            this.destroy(new Error('boom'))
          }
        }))
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')
  })

  it('should throw mid stream', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output = []

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
        throw new Error('boom')
      }
    })
    stream.on('error', () => {})

    await expect(
      pipe(
        input,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('destroyed').that.is.true()
    expect(stream).to.have.property('writable').that.is.false()
  })

  it('should make stream unwritable when write callback is passed an error immediately', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        cb(new Error('boom'))
      }
    })

    await expect(
      pipe(
        input,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.false()
  })

  it('should make stream unwritable when write callback is passed an error after a delay', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        setImmediate(() => {
          cb(new Error('boom'))
        })
      }
    })

    await expect(
      pipe(
        slowIterator(input),
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.false()
  })

  it('should make stream unwritable when write causes an error', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        stream.emit('error', new Error('boom'))
        setImmediate(() => cb())
      }
    })

    await expect(
      pipe(
        slowIterator(input),
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.false()
  })

  it('should make stream unwritable when write causes an error and source has no return method', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const source: any = {
      [Symbol.asyncIterator]: function () {
        return this
      },
      next: () => {
        return {
          value: input.pop(),
          done: !input.length
        }
      }
    }

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        stream.emit('error', new Error('boom'))
        setImmediate(() => cb())
      }
    })

    await expect(
      pipe(
        source,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.false()
  })

  it('should make stream unwritable when stream refuses new data and emits an error', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

    const source: any = {
      [Symbol.asyncIterator]: function () {
        return this
      },
      next: () => {
        return {
          value: input.pop(),
          done: !input.length
        }
      }
    }

    const stream = new Writable({
      autoDestroy: false,
      highWaterMark: 0, // cause sink to wait for drain event
      write (chunk, enc, cb) {
        setImmediate(() => cb(new Error('boom')))
      }
    })

    await expect(
      pipe(
        source,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.false()
  })

  it('should destroy writable stream if source throws', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    const output = []

    const source = {
      [Symbol.iterator]: function * () {
        yield * input[Symbol.iterator]()
        throw new Error('boom')
      }
    }

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
      }
    })
    stream.on('error', () => {})

    await expect(
      pipe(
        source,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('writable').that.is.false()
    expect(stream).to.have.property('destroyed').that.is.true()
  })

  it('stream should not error if source throws', async () => {
    const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
    let streamError

    const source = {
      [Symbol.iterator]: function * () {
        yield * input[Symbol.iterator]()
        throw new Error('boom')
      }
    }

    const stream = new Writable({
      autoDestroy: false,
      write (chunk, enc, cb) {
        cb()
      }
    })

    stream.once('error', (err) => {
      streamError = err
    })

    await expect(
      pipe(
        source,
        toIterable.sink(stream)
      )
    ).to.eventually.be.rejected
      .with.property('message', 'boom')

    expect(stream).to.have.property('destroyed').that.is.true()
    expect(stream).to.have.property('writable').that.is.false()
    expect(streamError).to.not.be.ok()
  })
})
