// App-update controls. The service worker installs a new version in the
// background but now WAITS (it no longer auto-activates) so the user is shown a
// banner and updates on their terms — no more silently running an old build,
// and no surprise reloads mid-task. main.jsx dispatches `lulu:update-ready`
// (and sets window.__luluUpdateReady) when a new version is waiting.

export function updateReady() {
  return typeof window !== 'undefined' && !!window.__luluUpdateReady
}

// Subscribe to "a new version is ready". Fires immediately if one already is.
export function onUpdateReady(cb) {
  if (typeof window === 'undefined') return () => {}
  if (window.__luluUpdateReady) { try { cb() } catch { /* ignore */ } }
  window.addEventListener('lulu:update-ready', cb)
  return () => window.removeEventListener('lulu:update-ready', cb)
}

// Activate the waiting version and reload. Falls back to a plain reload (the app
// shell is network-first, so a reload pulls the freshest build when online).
export async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (reg && reg.waiting) { reg.waiting.postMessage('SKIP_WAITING'); return }
  } catch { /* ignore */ }
  window.location.reload()
}

// Manual "Check for updates": ask the SW to look, wait briefly, then report
// 'updating' (a new version is now waiting — caller should applyUpdate) or
// 'current' (already on the latest).
export async function checkForUpdateNow() {
  try {
    if (!('serviceWorker' in navigator)) { window.location.reload(); return 'reloaded' }
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) { window.location.reload(); return 'reloaded' }
    if (reg.waiting) return 'updating'
    await reg.update()
    await new Promise((r) => setTimeout(r, 1500))
    const again = await navigator.serviceWorker.getRegistration()
    return (again && again.waiting) ? 'updating' : 'current'
  } catch {
    return 'current'
  }
}
