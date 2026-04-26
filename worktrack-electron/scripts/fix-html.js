'use strict'
// Removes crossorigin attributes from the built index.html.
// Vite adds these for CORS compliance on HTTP servers, but Electron
// loads files via file:// which doesn't support CORS — causing blank screens.
const fs   = require('fs')
const path = require('path')

const htmlPath = path.join(__dirname, '..', 'out', 'renderer', 'index.html')
const html     = fs.readFileSync(htmlPath, 'utf8')
const fixed    = html.replace(/ crossorigin(="[^"]*")?/g, '')
fs.writeFileSync(htmlPath, fixed)
console.log('[fix-html] Removed crossorigin from index.html')
