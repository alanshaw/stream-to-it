import type { Sink, Source } from 'it-stream-types'
import type { Writable } from 'node:stream'

/**
 * Convert a Node.js [`Writable`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_writable_streams)
 * stream to a [sink](https://achingbrain.github.io/it-stream-types/interfaces/Sink.html).
 */
export function sink <T> (writable: Writable): Sink<Source<T>, Promise<void>> {
  return async (source: Source<T>): Promise<void> => {
    const maybeEndSource = () => {
      if (isAsyncGenerator(source)) {
        // @ts-expect-error return method expects an argument
        return source.return()
      }
    }

    let error: Error | undefined
    let errCb: ((err: Error) => void) | undefined
    const errorHandler = (err: Error): void => {
      error = err
      errCb?.(err)
      // When the writable errors, try to end the source to exit iteration early
      maybeEndSource()
    }

    let closeCb: (() => void) | undefined
    let closed = false
    const closeHandler = () => {
      closed = true
      closeCb?.()
    }

    let finishCb: (() => void) | undefined
    let finished = false
    const finishHandler = () => {
      finished = true
      finishCb?.()
    }

    let drainCb: (() => void) | undefined
    const drainHandler = () => {
      drainCb?.()
    }

    const waitForDrainOrClose = () => {
      return new Promise<void>((resolve, reject) => {
        closeCb = drainCb = resolve
        errCb = reject

        writable.once('drain', drainHandler)
      })
    }

    const waitForDone = () => {
      // Immediately try to end the source
      maybeEndSource()
      return new Promise<void>((resolve, reject) => {
        if (closed || finished || error) return resolve()
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
        if (!writable.writable || writable.destroyed || error) {
          break
        }

        if (writable.write(value as any) === false) {
          await waitForDrainOrClose()
        }
      }
    } catch (err: any) {
      // error is set by stream error handler so only destroy stream if source
      // threw
      if (!error) {
        writable.destroy(err)
      }

      // could we be obscuring an error here?
      error = err
    }

    try {
      // We're done writing, end everything (n.b. stream may be destroyed at this
      // point but then this is a no-op)
      if (writable.writable) {
        writable.end()
      }

      // Wait until we close or finish. This supports halfClosed streams
      await waitForDone()

      // Notify the user an error occurred
      if (error) throw error
    } finally {
      // Clean up listeners
      cleanup()
    }
  }
}

function isAsyncGenerator <T = any> (obj?: any): obj is AsyncGenerator<T> {
  return obj.return != null
}
