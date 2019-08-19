'use strict'

const toSource = stream => stream
const toSink = require('./sink')
const toDuplex = stream => ({ sink: toSink(stream), source: toSource(stream) })

const toTransform = stream => source => (async function * () {
  const duplex = toDuplex(stream)
  // In a transform the sink and source are connected, an error in the sink
  // will be thrown in the source also. Catch the sink error to avoid unhandled
  // rejections and yield from the source.
  duplex.sink(source).catch(_ => {})
  yield * duplex.source
})()

module.exports = toSource
module.exports.source = toSource
module.exports.sink = toSink
module.exports.transform = toTransform
module.exports.duplex = toDuplex
