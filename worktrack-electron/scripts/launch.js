'use strict'
/**
 * Launch Electron with ELECTRON_RUN_AS_NODE cleared.
 * VS Code's terminal sets this flag for its own Electron process — it must be
 * removed before spawning our app or Electron runs as plain Node.js.
 */
delete process.env.ELECTRON_RUN_AS_NODE

const { spawn } = require('child_process')
const path      = require('path')

// The electron npm package exports the path to the binary
const electronBin = require('electron')
const appDir      = path.join(__dirname, '..')

const child = spawn(electronBin, [appDir], {
  stdio: 'inherit',
  env: process.env,
})

child.on('close', (code) => process.exit(code || 0))
child.on('error', (err) => { console.error(err); process.exit(1) })
