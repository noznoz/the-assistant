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

  // Proactively check for a new version whenever the app is opened or brought
  // back to the foreground. iOS resumes an installed PWA from the background
  // without re-running the page, so without this a new deploy is never noticed.
  const checkForUpdate = () => {
    navigator.serviceWorker.getRegistration()
      .then((reg) => reg && reg.update())
      .catch(() => {})
  }
  window.addEventListener('load', checkForUpdate)
  window.addEventListener('focus', checkForUpdate)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LuluApp />
  </React.StrictMode>
)
