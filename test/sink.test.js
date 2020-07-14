const test = require('ava')
const { Writable } = require('stream')
const toIterable = require('../')
const pipe = require('it-pipe')
const { randomInt, randomBytes } = require('./helpers/random')

const delay = require('delay')
const slowIterator = async function * (values) {
  for (const value of values) {
    await delay(1)
    yield value
  }
}

test('should convert to sink iterable', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  await pipe(
    input,
    toIterable.sink(new Writable({
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
      }
    }))
  )

  t.deepEqual(output, input)
})

test('should convert to sink iterable and call return on end', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  let i = 0
  let returnCalled = false
  const output = []

  await pipe(
    {
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
    },
    toIterable.sink(new Writable({
      write (chunk, enc, cb) {
        output.push(chunk)
        cb()
      }
    }))
  )

  t.is(returnCalled, true)
  t.deepEqual(output, input)
})

test('should end mid stream', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  const stream = new Writable({
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

  t.deepEqual(output, input.slice(0, 1))
  t.false(stream.destroyed)
  t.false(stream.writable)
})

test('should destroy mid stream', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  const stream = new Writable({
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

  t.deepEqual(output, input.slice(0, 1))
  t.true(stream.destroyed)
  t.false(stream.writable)
})

test('should destroy mid stream with error', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  const err = await t.throwsAsync(
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
  )

  t.is(err.message, 'boom')
})

test('should throw mid stream', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  const stream = new Writable({
    write (chunk, enc, cb) {
      output.push(chunk)
      cb()
      throw new Error('boom')
    }
  })

  const err = await t.throwsAsync(
    pipe(
      input,
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.true(stream.destroyed)
  t.false(stream.writable)
})

test('should make stream unwritable when write callback is passed an error immediately', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

  const stream = new Writable({
    write (chunk, enc, cb) {
      cb(new Error('boom'))
    }
  })

  const err = await t.throwsAsync(
    pipe(
      input,
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.false(stream.destroyed)
})

test('should make stream unwritable when write callback is passed an error after a delay', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

  const stream = new Writable({
    write (chunk, enc, cb) {
      setImmediate(() => {
        cb(new Error('boom'))
      })
    }
  })

  const err = await t.throwsAsync(
    pipe(
      slowIterator(input),
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.false(stream.destroyed)
})

test('should make stream unwritable when write causes an error', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

  const stream = new Writable({
    write (chunk, enc, cb) {
      stream.emit('error', new Error('boom'))
      setImmediate(() => cb())
    }
  })

  const err = await t.throwsAsync(
    pipe(
      slowIterator(input),
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.false(stream.destroyed)
})

test('should make stream unwritable when write causes an error and source has no return method', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

  const source = {
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
    write (chunk, enc, cb) {
      stream.emit('error', new Error('boom'))
      setImmediate(() => cb())
    }
  })

  const err = await t.throwsAsync(
    pipe(
      source,
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.false(stream.destroyed)
})

test('should make stream unwritable when stream refuses new data and emits an error', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))

  const source = {
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
    highWaterMark: 0, // cause sink to wait for drain event
    write (chunk, enc, cb) {
      setImmediate(() => cb(new Error('boom')))
    }
  })

  const err = await t.throwsAsync(
    pipe(
      source,
      toIterable.sink(stream)
    )
  )

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.false(stream.destroyed)
})

test('should destroy writable stream if source throws', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  const output = []

  const source = {
    [Symbol.iterator]: function * () {
      yield * input[Symbol.iterator]()
      throw new Error('boom')
    }
  }

  const stream = new Writable({
    write (chunk, enc, cb) {
      output.push(chunk)
      cb()
    }
  })

  const err = await t.throwsAsync(pipe(source, toIterable.sink(stream)))

  t.is(err.message, 'boom')
  t.false(stream.writable)
  t.true(stream.destroyed)
})

test('stream should not error if source throws', async t => {
  const input = Array.from(Array(randomInt(5, 10)), () => randomBytes(1, 512))
  let streamError

  const source = {
    [Symbol.iterator]: function * () {
      yield * input[Symbol.iterator]()
      throw new Error('boom')
    }
  }

  const stream = new Writable({
    write (chunk, enc, cb) {
      cb()
    }
  })

  stream.once('error', (err) => {
    streamError = err
  })

  const err = await t.throwsAsync(pipe(source, toIterable.sink(stream)))

  t.is(err.message, 'boom')
  t.true(stream.destroyed)
  t.false(stream.writable)
  t.falsy(streamError)
})
