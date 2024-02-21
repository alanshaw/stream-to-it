/**
 * @packageDocumentation
 *
 * Seamlessly use Node.js streams with `it-pipe` and friends.
 *
 * @example Convert readable stream to source iterable
 *
 * ```TypeScript
 * import fs from 'node:fs'
 * import * as toIterable from 'stream-to-it'
 *
 * const readable = fs.createReadStream('/path/to/file')
 * // Node.js streams are already async iterable so this is just s => s
 * const source = toIterable.source<Buffer>(readable)
 *
 * for await (const chunk of source) {
 *   console.log(chunk.toString())
 * }
 * ```
 *
 * Also works with browser [`ReadableStream`](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream):
 *
 * ```TypeScript
 * import * as toIterable from 'stream-to-it'
 *
 * const res = await fetch('http://example.org/file.jpg')
 *
 * if (res.body == null) {
 *   throw new Error('Body was not set')
 * }
 *
 * for await (const chunk of toIterable.source(res.body)) {
 *   console.log(chunk.toString())
 * }
 * ```
 *
 * @example Convert writable stream to sink iterable
 *
 * ```TypeScript
 * import fs from 'node:fs'
 * import { pipe } from 'it-pipe'
 * import * as toIterable from 'stream-to-it'
 *
 * const source = [Buffer.from('Hello '), Buffer.from('World!')]
 * const sink = toIterable.sink(fs.createWriteStream('/path/to/file'))
 *
 * await pipe(source, sink)
 * ```
 *
 * @example Convert transform stream to transform iterable
 *
 * ```TypeScript
 * import fs from 'node:fs'
 * import { Transform } from 'node:stream'
 * import { pipe } from 'it-pipe'
 * import * as toIterable from 'stream-to-it'
 *
 * const output = await pipe(
 *   [true, false, true, true],
 *   toIterable.transform(new Transform({ // Inverter transform :)
 *     transform (chunk, enc, cb) {
 *       cb(null, !chunk)
 *     }
 *   })),
 *   // Collect and return the chunks
 *   async source => {
 *     const chunks = []
 *     for await (const chunk of source) chunks.push(chunk)
 *     return chunks
 *   }
 * )
 *
 * console.log(output) // [ false, true, false, false ]
 * ```
 *
 * ## Related
 *
 * - [`it-to-stream`](https://www.npmjs.com/package/it-to-stream) Convert streaming iterables to Node.js streams
 * - [`it-pipe`](https://www.npmjs.com/package/it-pipe) Utility to "pipe" async iterables together
 */

export { source } from './source.js'
export { sink } from './sink.js'
export { transform } from './transform.js'
export { duplex } from './duplex.js'
