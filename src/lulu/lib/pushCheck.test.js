import { describe, it, expect } from 'vitest'
import { pushSteps, allOk, needsSql } from './pushCheck.js'
import { pushSetupSql } from './pushSql.js'

const now = '2026-11-21T19:00:00.000Z'
const good = {
  ios: true, standalone: true, supported: true, cloud: true, perm: 'granted', subscribed: true,
  server: { ok: true, registered: true, lastRun: '2026-11-21T18:59:10.000Z', now, cron: { scheduled: true, last_status: 200 } },
}
const step = (f, id) => pushSteps(f).find(s => s.id === id)

describe('background push checklist', () => {
  it('all green when every link holds', () => {
    const s = pushSteps(good)
    expect(allOk(s)).toBe(true)
    expect(needsSql(s)).toBe(false)
  })

  it('iPhone in Safari: install comes first, the rest waits', () => {
    const s = pushSteps({ ...good, standalone: false, supported: false, subscribed: false, perm: 'default' })
    expect(s[0]).toMatchObject({ id: 'install', state: 'todo', hint: 'pstInstallHint' })
    expect(s.find(x => x.id === 'allow').state).toBe('wait')
  })

  it('function not deployed vs. tables missing vs. other errors', () => {
    expect(step({ ...good, server: null, serverErr: 'Requested function was not found' }, 'server').hint).toBe('pstServerDeploy')
    expect(step({ ...good, server: null, serverErr: 'HTTP 404' }, 'server').hint).toBe('pstServerDeploy')
    const sql = { ...good, server: { error: 'setup-sql' } }
    expect(step(sql, 'server')).toMatchObject({ hint: 'pstServerSql', needsSql: true })
    expect(needsSql(pushSteps(sql))).toBe(true)
    expect(step({ ...good, server: null, serverErr: 'Failed to fetch' }, 'server')).toMatchObject({ hint: 'pstServerError', detail: 'Failed to fetch' })
  })

  it('permission and registration', () => {
    expect(step({ ...good, perm: 'denied' }, 'allow')).toMatchObject({ ok: false, hint: 'pstAllowDenied', action: undefined })
    expect(step({ ...good, perm: 'default' }, 'allow')).toMatchObject({ ok: false, action: 'enable' })
    // Subscribed in the browser but the server never stored it (e.g. table was missing).
    expect(step({ ...good, server: { ...good.server, registered: false } }, 'device').ok).toBe(false)
  })

  it('schedule: never ran, blocked by the JWT switch, stopped', () => {
    const never = step({ ...good, server: { ...good.server, lastRun: null, cron: null } }, 'schedule')
    expect(never).toMatchObject({ ok: false, hint: 'pstScheduleNever', needsSql: true })
    const jwt = step({ ...good, server: { ...good.server, lastRun: null, cron: { scheduled: true, last_status: 401 } } }, 'schedule')
    expect(jwt).toMatchObject({ ok: false, hint: 'pstScheduleJwt', needsSql: false })
    const stale = step({ ...good, server: { ...good.server, lastRun: '2026-11-21T17:00:00.000Z' } }, 'schedule')
    expect(stale).toMatchObject({ ok: false, hint: 'pstScheduleStale' })
    expect(step({ ...good, server: { ...good.server, lastRun: null, cron: { scheduled: true, last_status: 404 } } }, 'schedule').hint).toBe('pstScheduleNotFound')
  })

  it('setup SQL carries the project address and nothing unsafe', () => {
    const sql = pushSetupSql("https://abc.supabase.co/'; drop table x; --")
    expect(sql).not.toContain("'; drop")
    expect(pushSetupSql('https://abc.supabase.co/')).toContain("url := 'https://abc.supabase.co/functions/v1/lulu-mcp/cron'")
    expect(pushSetupSql()).toContain('YOUR-PROJECT')
  })
})
