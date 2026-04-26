import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Electron loads from file:// which doesn't support CORS.
// Vite adds crossorigin="" to module scripts by default — remove it.
function removeElectronCrossOrigin() {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml: {
      enforce: 'post',
      transform: (html) => html.replace(/ crossorigin="?[^"]*"?/g, ''),
    },
  }
}

export default defineConfig({
  plugins: [react(), removeElectronCrossOrigin()],
  base: './',
  root: resolve('src/renderer'),
  build: {
    outDir: resolve('out/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve('src/renderer/index.html'),
    },
  },
})
