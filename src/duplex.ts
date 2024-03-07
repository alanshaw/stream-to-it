import { sink } from './sink.js'
import { source } from './source.js'
import type { Duplex } from 'node:stream'
import type { Source, Duplex as ItDuplex } from 'it-stream-types'

/**
 * Convert a Node.js [`Duplex`](https://nodejs.org/dist/latest/docs/api/stream.html#stream_duplex_and_transform_streams)
 * stream to a [duplex iterable](https://achingbrain.github.io/it-stream-types/interfaces/Duplex.html).
 */
export function duplex <TSource = unknown, TSink = TSource> (duplex: Duplex): ItDuplex<AsyncGenerator<TSource>, Source<TSink>, Promise<void>> {
  return {
    sink: sink(duplex),
    source: source(duplex)
  }
}
