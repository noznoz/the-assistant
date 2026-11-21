// The background-push checklist: turn what we can observe (this phone, cloud,
// the send-reminders function and its schedule) into ordered steps, each ok or
// not, with the one thing to do next. Pure, so it's unit-tested; gathering the
// facts lives in lib/push.js (pushFacts).
//
// facts: {
//   ios, standalone, supported,        this device
//   cloud,                             signed in to cloud sync
//   perm,                              Notification.permission | 'unsupported'
//   subscribed,                        this browser has a push subscription
//   server: { ok, registered, lastRun, now, cron: { scheduled, last_status } } | { error }
//   serverErr                          message when the function couldn't be reached
// }

const FRESH_MS = 3 * 60 * 1000 // the schedule runs every minute; allow some slack

export function pushSteps(f) {
  const steps = []
  if (f.ios) steps.push({ id: 'install', ok: !!f.standalone, hint: 'pstInstallHint' })
  else steps.push({ id: 'install', ok: !!f.supported, hint: 'pstUnsupportedHint' })

  steps.push({ id: 'cloud', ok: !!f.cloud, hint: 'pstCloudHint' })

  const s = f.server
  let serverHint = 'pstServerDeploy'
  if (s && s.error === 'setup-sql') serverHint = 'pstServerSql'
  else if (f.serverErr && !/404|not.?found/i.test(f.serverErr)) serverHint = 'pstServerError'
  steps.push({ id: 'server', ok: !!(s && s.ok), hint: serverHint, detail: serverHint === 'pstServerError' ? f.serverErr : undefined, needsSql: serverHint === 'pstServerSql' })

  steps.push({ id: 'allow', ok: f.perm === 'granted', hint: f.perm === 'denied' ? 'pstAllowDenied' : 'pstAllowHint', action: f.perm === 'denied' ? undefined : 'enable' })

  steps.push({ id: 'device', ok: !!(f.subscribed && s && s.registered), hint: 'pstDeviceHint', action: 'enable' })

  let scheduleOk = false, scheduleHint = 'pstScheduleNever', needsSql = true
  if (s && s.ok) {
    const last = s.lastRun ? Date.parse(s.lastRun) : NaN
    const now = s.now ? Date.parse(s.now) : Date.now()
    scheduleOk = Number.isFinite(last) && now - last < FRESH_MS
    const c = s.cron
    if (!scheduleOk) {
      if (c && (c.last_status === 401 || c.last_status === 403)) { scheduleHint = 'pstScheduleJwt'; needsSql = false }
      else if (c && c.scheduled && c.last_status === 404) { scheduleHint = 'pstScheduleNotFound'; needsSql = false }
      else if (c && c.scheduled) { scheduleHint = 'pstScheduleStale'; needsSql = false }
    }
  }
  steps.push({ id: 'schedule', ok: scheduleOk, hint: scheduleHint, needsSql: !scheduleOk && needsSql, lastRun: s && s.lastRun })

  // Everything before a failing step must hold first; show later ones as waiting.
  let blocked = false
  for (const st of steps) {
    st.state = st.ok ? 'ok' : blocked ? 'wait' : 'todo'
    if (!st.ok && st.id !== 'allow' && st.id !== 'device') blocked = blocked || st.id === 'install' || st.id === 'cloud'
  }
  return steps
}

export const allOk = (steps) => steps.every(s => s.ok)
// The SQL is the fix for any step that says so.
export const needsSql = (steps) => steps.some(s => !s.ok && s.needsSql)
