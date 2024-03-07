// Copied from https://github.com/alanshaw/stream-to-it/issues/6#issue-589555329

/**
 * Running with Clinic.js
 *
 * This will open the Clinic report in your default browser.
 *
 * 1. Install Clinic.js `npm install -g clinic`
 * 2. From project root: `clinic doctor -- node ./benchmark/memory.js`
 */

import fs from 'node:fs'
import os from 'node:os'
import { pipe } from 'it-pipe'
import { sink } from '../dist/src/index.js'

async function * run () {
  for (let i = 0; i < 170000; i++) {
    yield Buffer.alloc(4096)
  }
}

(async () => {
  const s = sink(fs.createWriteStream(`${os.tmpdir()}/memcheck.txt`))
  await pipe(run(), s)
  process.exit(1)
})()
