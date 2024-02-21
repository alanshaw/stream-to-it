// Copied from https://github.com/alanshaw/stream-to-it/issues/6#issue-589555329

/**
 * Running with Clinic.js
 *
 * This will open the Clinic report in your default browser.
 *
 * 1. Install Clinic.js `npm install -g clinic`
 * 2. From project root: `clinic doctor -- node ./benchmark/memory.js`
 */

const fs = require('fs')
const os = require('os')
const toIterable = require('../')
import { pipe } from 'it-pipe'

async function * run () {
  for (let i = 0; i < 170000; i++) {
    yield Buffer.alloc(4096)
  }
}

(async () => {
  const sink = toIterable.sink(fs.createWriteStream(`${os.tmpdir()}/memcheck.txt`))
  await pipe(run(), sink)
  process.exit(1)
})()
