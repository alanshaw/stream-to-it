const getIterator = require('get-iterator')

module.exports = writable => async source => {
  source = getIterator(source)

  const endSource = (source) => {
    if (typeof source.return === 'function') source.return()
  }

  let error = null
  let errCb = null
  const errorHandler = (err) => {
    error = err
    if (errCb) errCb()
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

  const waitForDrain = () => {
    return new Promise((resolve, reject) => {
      drainCb = resolve
      errCb = reject
      writable.once('drain', drainHandler)
    })
  }

  const waitForDone = () => {
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

      if (writable.write(value) === false) {
        await waitForDrain()
      }
    }
  } catch (err) {
    // The writable did not error, give it the error
    writable.destroy(err)
  }

  // Everything is good and we're done writing, end everything
  if (!error && writable.writable) {
    writable.end()
    endSource(source)
  }

  // Wait until we close or finish. This supports halfClosed streams
  await waitForDone()

  // Clean up listeners
  cleanup()

  // Notify the user an error occurred
  if (error) throw error
}
