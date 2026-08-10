import React, { useState, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Field, Input, Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { fmtDate, fmtTime, relativeDay } from '../../lib/format.js'
import { splitReminders } from '../../lib/reminders.js'
import { notificationPermission, requestNotificationPermission } from '../../lib/notify.js'
import { pushSupported, pushConfigured, isPushEnabled, enablePush, disablePush, refreshPush } from '../../lib/push.js'
import * as cloud from '../../lib/cloud.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const pad = (n) => String(n).padStart(2, '0')
const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
function defaultWhen() { const d = new Date(Date.now() + 60 * 60 * 1000); d.setSeconds(0, 0); return toInput(d) }

// Quick "when" presets.
function presets() {
  const mk = (d) => { d.setSeconds(0, 0); return toInput(d) }
  const inHour = new Date(Date.now() + 60 * 60 * 1000)
  const tonight = new Date(); tonight.setHours(20, 0, 0, 0); if (tonight.getTime() < Date.now()) tonight.setDate(tonight.getDate() + 1)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(9, 0, 0, 0)
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(9, 0, 0, 0)
  return [
    { key: 'inHour', when: mk(inHour) },
    { key: 'tonight', when: mk(tonight) },
    { key: 'tomorrow', when: mk(tomorrow) },
    { key: 'nextWeek', when: mk(nextWeek) },
  ]
}

export default function RemindersScreen({ go }) {
  const { t, lang } = useT()
  const reminders = useCollection('reminders')
  const toast = useToast()
  const [text, setText] = useState('')
  const [when, setWhen] = useState(defaultWhen)
  const [err, setErr] = useState('')
  const [perm, setPerm] = useState(notificationPermission())
  const [bg, setBg] = useState(false)
  const [bgBusy, setBgBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  useEffect(() => { isPushEnabled().then(setBg) }, [])

  // Send a real background push right now to check the whole pipeline
  // (subscription → server → device) without waiting for a reminder to come due.
  const sendTest = async () => {
    setTestBusy(true)
    try {
      await refreshPush() // make sure this device's subscription is current first
      const r = await cloud.invokeFunction('send-reminders', { test: true, household_id: cloud.householdId() })
      if (r && r.sent > 0) toast.show(t('testPushSent'))
      else if (r && !r.subscriptions) toast.show(t('testPushNoSub'))
      else toast.show(t('testPushFailed'))
    } catch {
      toast.show(t('testPushError'))
    } finally { setTestBusy(false) }
  }

  const toggleBg = async () => {
    setBgBusy(true)
    try {
      if (bg) { await disablePush(); setBg(false); toast.show(t('savedToast')) }
      else {
        const r = await enablePush()
        if (r.ok) { setBg(true); toast.show(t('bgEnabled')) }
        else toast.show(r.reason === 'denied' ? t('reminderPermHint') : r.reason === 'not-connected' ? t('bgNeedsCloud') : t('bgNotConfigured'))
      }
    } finally { setBgBusy(false) }
  }

  const { upcoming, past } = splitReminders(reminders.items)

  const add = () => {
    if (!text.trim()) { setErr(t('required')); return }
    if (!when) { setErr(t('required')); return }
    reminders.add({ text: text.trim(), remindAt: new Date(when).toISOString(), notified: false, done: false })
    setText(''); setWhen(defaultWhen()); setErr('')
    toast.show(t('reminderSet'))
  }

  const askPermission = async () => { setPerm(await requestNotificationPermission()) }

  const whenLabel = (r) => `${relativeDay(r.remindAt, lang)} · ${fmtTime(r.remindAt, lang)}`

  return (
    <>
      <DetailHeader title={t('reminders')} onBack={() => go('more')} />
      <div className="screen">

        {perm !== 'granted' && perm !== 'unsupported' && (
          <Card className="stack" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="lead t-warn" style={{ flexShrink: 0 }}><Icon name="bell" size={16} /></span>
              <div style={{ flex: 1, fontSize: 13 }}>{t('reminderPermHint')}</div>
            </div>
            <Button variant="primary" icon="bell" onClick={askPermission}>{t('enableNotifications')}</Button>
          </Card>
        )}

        {/* Background push (deliver while the app is closed) */}
        {pushSupported() && (
          <Card className="stack" style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className={`lead ${bg ? 't-ok' : 't-info'}`} style={{ flexShrink: 0 }}><Icon name="bell" size={16} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{t('bgReminders')}</div>
                <div className="muted" style={{ fontSize: 12 }}>{bg ? t('bgOnState') : t('bgRemindersHint')}</div>
              </div>
            </div>
            {!pushConfigured()
              ? <p className="hint" style={{ margin: '0 2px' }}>{t('bgNotConfigured')}</p>
              : !cloud.isReady()
                ? <p className="hint" style={{ margin: '0 2px' }}>{t('bgNeedsCloud')}</p>
                : <>
                  <Button variant={bg ? 'ghost' : 'primary'} icon="bell" onClick={toggleBg} disabled={bgBusy}>{bg ? t('bgDisable') : t('bgEnable')}</Button>
                  {bg && <Button variant="ghost" icon="bell" onClick={sendTest} disabled={testBusy}>{testBusy ? t('testPushSending') : t('testPush')}</Button>}
                </>}
            <p className="hint" style={{ margin: '0 2px' }}>{t('bgIosHint')}</p>
          </Card>
        )}

        {/* Add */}
        <Card className="stack" style={{ marginTop: 12 }}>
          <Field label={t('reminderWhat')} required error={err}>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={t('reminderWhatPlaceholder')} autoFocus
              onKeyDown={e => { if (e.key === 'Enter') add() }} />
          </Field>
          <Field label={t('reminderWhen')}>
            <Input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} />
          </Field>
          <div className="chip-row">
            {presets().map(p => (
              <Chip key={p.key} selectable on={when === p.when} onClick={() => setWhen(p.when)}>{t(p.key)}</Chip>
            ))}
          </div>
          <Button block variant="primary" icon="bell" onClick={add}>{t('addReminder')}</Button>
        </Card>

        {/* Upcoming */}
        {upcoming.length === 0 && past.length === 0 ? (
          <Empty icon="bell" title={t('noReminders')} text={t('remindersHint')} />
        ) : (
          <>
            {upcoming.length > 0 && <h2 className="member-h2" style={{ marginTop: 18 }}>{t('upcoming')}</h2>}
            {upcoming.map(r => (
              <SwipeRow key={r.id} onDelete={() => { reminders.remove(r.id); toast.show(t('deletedToast')) }}>
                <div className="li">
                  <div className="lead t-brand"><Icon name="bell" size={16} /></div>
                  <div className="body">
                    <div className="title">{r.text}</div>
                    <div className="meta">{whenLabel(r)}</div>
                  </div>
                  <button className="iconbtn" aria-label={t('markComplete')} onClick={() => { reminders.patch(r.id, { done: true }); toast.show('✓') }}><Icon name="check" size={16} /></button>
                </div>
              </SwipeRow>
            ))}

            {past.length > 0 && <h2 className="member-h2" style={{ marginTop: 18 }}>{t('past')}</h2>}
            {past.map(r => (
              <SwipeRow key={r.id} onDelete={() => { reminders.remove(r.id); toast.show(t('deletedToast')) }}>
                <div className="li" style={{ opacity: 0.6 }}>
                  <div className={`lead ${r.done ? 't-ok' : 't-warn'}`}><Icon name={r.done ? 'check' : 'clock'} size={16} /></div>
                  <div className="body">
                    <div className="title" style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.text}</div>
                    <div className="meta">{fmtDate(r.remindAt, lang)} · {fmtTime(r.remindAt, lang)}</div>
                  </div>
                  {!r.done && <button className="iconbtn" aria-label={t('markComplete')} onClick={() => reminders.patch(r.id, { done: true })}><Icon name="check" size={16} /></button>}
                </div>
              </SwipeRow>
            ))}
          </>
        )}
      </div>
      {toast.node}
    </>
  )
}
