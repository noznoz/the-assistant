import React from 'react'
import Icon from './Icon.jsx'

// Catches render errors so a bug shows a recoverable screen (with the actual
// error text) instead of a blank "crash". React error boundaries must be class
// components. Keyed by route in LuluApp so navigating away clears the error.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Keep the last error so it can be surfaced/diagnosed later.
    try {
      localStorage.setItem('lulu:lastError', JSON.stringify({
        message: String(error && error.message || error),
        stack: String(error && error.stack || ''),
        component: String(info && info.componentStack || ''),
        at: new Date().toISOString(),
      }))
    } catch { /* ignore */ }
    // eslint-disable-next-line no-console
    console.error('Lulu screen error:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    const msg = String(this.state.error.message || this.state.error)
    return (
      <div style={{ padding: '80px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 68, height: 68, borderRadius: 22, background: 'var(--danger-tint)', color: 'var(--danger)', display: 'grid', placeItems: 'center' }}>
          <Icon name="shield" size={32} />
        </div>
        <h3 style={{ fontSize: 18 }}>Something went wrong</h3>
        <p style={{ color: 'var(--ink-3)', fontSize: 14, maxWidth: 300 }}>
          This screen hit an error. You can go back to Today, or reload the app. Nothing was lost.
        </p>
        <code style={{
          fontSize: 12, color: 'var(--ink-2)', background: 'var(--surface-2)', border: '1px solid var(--line)',
          borderRadius: 10, padding: '8px 12px', maxWidth: 320, overflowWrap: 'anywhere',
        }}>{msg}</code>
        <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
          <button className="btn" onClick={() => { window.location.hash = '#/today'; this.setState({ error: null }) }}>Go to Today</button>
          <button className="btn primary" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    )
  }
}
