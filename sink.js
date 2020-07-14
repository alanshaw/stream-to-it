const getIterator = require('get-iterator')

module.exports = writable => async source => {
  source = getIterator(source)

  const endSource = (source) => {
    if (typeof source.return === 'function') source.return()
  }

  let streamError = null
  let sourceError = null
  let errCb = null
  const errorHandler = (err) => {
    streamError = err
    if (errCb) errCb(err)
    // When the writable errors, end the source to exit iteration early
    endSource(source)
  }

  let closeCb = null
  let closed = false
  const closeHandler = () => {
    closed = true
    if (closeCb) closeCb()
  }

  let finishCb = null
  let finished = false
  const finishHandler = () => {
    finished = true
    if (finishCb) finishCb()
  }

  let drainCb = null
  const drainHandler = () => {
    if (drainCb) drainCb()
  }

  const waitForDrainOrClose = () => {
    return new Promise((resolve, reject) => {
      closeCb = drainCb = resolve
      errCb = reject
      writable.once('drain', drainHandler)
    })
  }

  const waitForDone = () => {
    // Immediately end the source
    endSource(source)
    return new Promise((resolve, reject) => {
      if (closed || finished) return resolve()
      finishCb = closeCb = resolve
      errCb = reject
    })
  }

  const cleanup = () => {
    writable.removeListener('error', errorHandler)
    writable.removeListener('close', closeHandler)
    writable.removeListener('finish', finishHandler)
    writable.removeListener('drain', drainHandler)
  }

  writable.once('error', errorHandler)
  writable.once('close', closeHandler)
  writable.once('finish', finishHandler)

  try {
    for await (const value of source) {
      if (!writable.writable || writable.destroyed) break

      let writeMore = false

      try {
        // if write throws, no error event will occur
        writeMore = writable.write(value)
      } catch (err) {
        streamError = err
        throw err
      }

      if (writeMore === false) {
        await waitForDrainOrClose()
      }
    }
  } catch (err) {
    writable.destroy()

    // waitForDrainOrClose can throw with an error from the stream
    // which would have been set as streamError by errorHandler
    if (err !== streamError) {
      sourceError = err
    }
  }

  try {
    // We're done writing, end everything (n.b. stream may be destroyed at this point)
    if (writable.writable) {
      writable.end()
    }

    // Wait until we close or finish. This supports halfClosed streams
    await waitForDone()

    // Notify the user an error occurred
    if (sourceError) throw sourceError
    if (streamError) throw streamError
  } finally {
    // Clean up listeners
    cleanup()
  }
}
