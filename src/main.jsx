import React from 'react'
import ReactDOM from 'react-dom/client'
import LuluApp from './lulu/LuluApp.jsx'

// A new service worker installs in the background but WAITS — we surface a
// "new version" banner (see lib/appUpdate.js) and let the user apply it, so the
// app never silently runs an old build and never reloads mid-task.
if ('serviceWorker' in navigator) {
  let reloading = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return
    reloading = true
    window.location.reload()
  })

  // Flag a ready update so the in-app banner (and Settings) can show it. Only
  // when there's already a controller — a first install isn't an "update".
  const markReady = () => {
    if (!navigator.serviceWorker.controller) return
    window.__luluUpdateReady = true
    try { window.dispatchEvent(new CustomEvent('lulu:update-ready')) } catch { /* ignore */ }
  }

  navigator.serviceWorker.getRegistration().then((reg) => {
    if (!reg) return
    if (reg.waiting) markReady()
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing
      if (!nw) return
      nw.addEventListener('statechange', () => {
        if (nw.state === 'installed') markReady()
      })
    })
  }).catch(() => {})

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
