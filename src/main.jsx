import React from 'react'
import ReactDOM from 'react-dom/client'
import LuluApp from './lulu/LuluApp.jsx'

// When a new service worker takes over (skipWaiting fired), reload so the fresh
// JS bundle runs — without this the old code stays active indefinitely.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LuluApp />
  </React.StrictMode>
)
