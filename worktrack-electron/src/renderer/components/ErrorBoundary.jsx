import React, { Component } from 'react'

// A crash inside a page should show what broke, not a blank window.
export default class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  componentDidCatch(error, info) { console.error('[Render Error]', error, info?.componentStack) }
  componentDidUpdate(prev) {
    // Clear the error when the route changes, so navigating away recovers.
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null })
  }

  render() {
    if (this.state.error) return (
      <div className="h-full overflow-auto flex flex-col items-center justify-center p-8 bg-surface-900">
        <p className="text-red-400 text-xl font-bold mb-4">Render Error</p>
        <pre className="text-red-300 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-4 max-w-2xl overflow-auto whitespace-pre-wrap">
          {this.state.error?.message}{'\n\n'}{this.state.error?.stack}
        </pre>
        <button onClick={() => this.setState({ error: null })}
          className="mt-4 px-4 py-2 bg-accent-500 text-white rounded-xl text-sm">
          Try Again
        </button>
      </div>
    )
    return this.props.children
  }
}
