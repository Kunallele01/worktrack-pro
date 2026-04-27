'use strict'
const esbuild = require('esbuild')
const path    = require('path')
const fs      = require('fs')

const outDir = path.join(__dirname, '..', 'out', 'preload')
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })

esbuild.buildSync({
  entryPoints: [path.join(__dirname, '..', 'electron', 'preload.js')],
  bundle:   true,
  platform: 'node',
  target:   'node18',
  outfile:  path.join(outDir, 'preload.js'),
  external: ['electron'],
  format:   'cjs',
})

console.log('[build-preload] Built out/preload/preload.js')
