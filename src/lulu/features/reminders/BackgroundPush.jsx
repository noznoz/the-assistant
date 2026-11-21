import React, { useState, useEffect, useCallback } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { pushFacts, enablePush, disablePush, refreshPush } from '../../lib/push.js'
import { pushSteps, allOk, needsSql } from '../../lib/pushCheck.js'
import { pushSetupSql } from '../../lib/pushSql.js'
import * as cloud from '../../lib/cloud.js'

// Background reminders (push while the app is closed), as a checklist: every
// link in the chain — this phone, cloud, the server function, its schedule —
// with a tick or the one thing to do next. Shown on every device, including
// iPhone Safari before the app is on the Home Screen (that's step one).
export default function BackgroundPush() {
  const { t, lang } = useT()
  const toast = useToast()
  const [facts, setFacts] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showSql, setShowSql] = useState(false)

  const check = useCallback(async () => { setFacts(await pushFacts()) }, [])
  useEffect(() => { check() }, [check])

  const steps = facts ? pushSteps(facts) : []
  const done = facts && allOk(steps)
  const sqlNeeded = facts && needsSql(steps)
  const sql = pushSetupSql((cloud.getConfig() || {}).url)

  const turnOn = async () => {
    setBusy(true)
    try {
      const r = await enablePush()
      if (r.ok) toast.show(t('bgEnabled'))
      else toast.show(r.reason === 'denied' ? t('pstAllowDenied') : r.reason === 'not-connected' ? t('bgNeedsCloud')
        : r.reason === 'not-saved' ? t('pstServerSql') : r.reason === 'unsupported' ? t('pstInstallHint') : t('bgNotConfigured'))
      await check()
    } finally { setBusy(false) }
  }
  const turnOff = async () => { setBusy(true); try { await disablePush(); await check(); toast.show(t('savedToast')) } finally { setBusy(false) } }
  const sendTest = async () => {
    setBusy(true)
    try {
      await refreshPush()
      const r = await cloud.invokeFunction('send-reminders', { test: true, household_id: cloud.householdId() })
      toast.show(r && r.sent > 0 ? t('testPushSent') : r && !r.subscriptions ? t('testPushNoSub') : t('testPushFailed'))
    } catch { toast.show(t('testPushError')) } finally { setBusy(false) }
  }
  const copy = (text) => { navigator.clipboard?.writeText(text); toast.show(t('copied')) }
  const ago = (iso) => {
    if (!iso) return ''
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
    return m < 1 ? t('justNow') : m < 120 ? `${m} ${t('minAgo')}` : new Date(iso).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  }
  const canAct = facts && facts.supported && facts.cloud && (!facts.ios || facts.standalone)

  return (
    <Card className="stack" style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className={`lead ${done ? 't-ok' : 't-info'}`} style={{ flexShrink: 0 }}><Icon name="bell" size={16} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700 }}>{t('bgReminders')}</div>
          <div className="muted small">{done ? t('pstAllGood') : t('bgRemindersHint')}</div>
        </div>
      </div>

      {!facts ? <p className="muted small" style={{ margin: 0 }}>{t('pushChecking')}</p> : (
        <ol className="push-steps" aria-label={t('bgReminders')}>
          {steps.map(st => (
            <li key={st.id} className={`ps ${st.state}`}>
              <span className="ps-ic" aria-hidden="true">{st.state === 'ok' ? <Icon name="check" size={14} /> : st.state === 'todo' ? '!' : '·'}</span>
              <div className="ps-body">
                <div className="ps-title">{t('pst_' + st.id)}<span className="sr-only"> — {st.ok ? t('done') : t('notYet')}</span></div>
                {!st.ok && st.state === 'todo' && (
                  <div className="ps-hint">
                    {t(st.hint)}{st.detail ? ` ${st.detail}` : ''}
                    {st.id === 'schedule' && st.lastRun && st.hint === 'pstScheduleStale' ? ` ${ago(st.lastRun)}.` : ''}
                  </div>
                )}
                {st.ok && st.id === 'schedule' && st.lastRun && <div className="ps-hint">{t('pstLastRun')} {ago(st.lastRun)}</div>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {facts && canAct && (
        facts.subscribed && facts.perm === 'granted'
          ? <div className="row2">
              <Button icon="bell" onClick={sendTest} disabled={busy}>{busy ? t('testPushSending') : t('testPush')}</Button>
              <Button variant="ghost" icon="x" onClick={turnOff} disabled={busy}>{t('bgDisable')}</Button>
            </div>
          : <Button variant="primary" icon="bell" onClick={turnOn} disabled={busy}>{t('pstTurnOn')}</Button>
      )}
      {facts && facts.subscribed && facts.perm === 'granted' && !(facts.server && facts.server.registered) && facts.server && facts.server.ok && (
        <Button icon="refresh" onClick={turnOn} disabled={busy}>{t('pstRegisterAgain')}</Button>
      )}

      {facts && facts.cloud && (sqlNeeded || showSql) && (
        <>
          <div className="label">{t('pushSetupSql')}</div>
          <p className="hint" style={{ margin: 0 }}>{t('pushSetupSqlHint')}</p>
          <pre className="sql-box">{sql}</pre>
          <Button icon="copy" onClick={() => copy(sql)}>{t('cloudCopySql')}</Button>
        </>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <button className="link-btn" onClick={check} disabled={busy}>{t('pushCheckAgain')}</button>
        {facts && facts.cloud && !sqlNeeded && <button className="link-btn" onClick={() => setShowSql(v => !v)}>{t('pushSetupSql')}</button>}
      </div>
      {toast.node}
    </Card>
  )
}
