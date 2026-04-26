import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/300.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import App from './App'

function mount() {
  const root = document.getElementById('root')
  if (!root) {
    // Should never happen, but guard against it
    console.error('[WorkTrack] #root element not found')
    return
  }
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

// Electron file:// loads modules before DOMContentLoaded fires.
// Guard against that edge case.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
