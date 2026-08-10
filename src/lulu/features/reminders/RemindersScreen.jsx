import React, { useState, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Field, Input, Button, Empty, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { fmtDate, fmtTime, relativeDay } from '../../lib/format.js'
import { splitReminders, buildReminderFields, reminderTimes, nextPendingTime, lastTime, pendingCount, MAX_TIMES } from '../../lib/reminders.js'
import { notificationPermission, requestNotificationPermission } from '../../lib/notify.js'
import { pushSupported, pushConfigured, isPushEnabled, enablePush, disablePush, refreshPush } from '../../lib/push.js'
import * as cloud from '../../lib/cloud.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

const pad = (n) => String(n).padStart(2, '0')
const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const isoToInput = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : toInput(d) }
const inputToIso = (s) => { const d = new Date(s); return isNaN(d) ? null : d.toISOString() }
function defaultWhen() { const d = new Date(Date.now() + 60 * 60 * 1000); d.setSeconds(0, 0); return toInput(d) }

// Quick "when" presets (applied to the first alert time).
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
  const [times, setTimes] = useState([defaultWhen()])
  const [editingId, setEditingId] = useState(null)
  const [err, setErr] = useState('')
  const [perm, setPerm] = useState(notificationPermission())
  const [bg, setBg] = useState(false)
  const [bgBusy, setBgBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  useEffect(() => { isPushEnabled().then(setBg) }, [])

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

  const sendTest = async () => {
    setTestBusy(true)
    try {
      await refreshPush()
      const r = await cloud.invokeFunction('send-reminders', { test: true, household_id: cloud.householdId() })
      if (r && r.sent > 0) toast.show(t('testPushSent'))
      else if (r && !r.subscriptions) toast.show(t('testPushNoSub'))
      else toast.show(t('testPushFailed'))
    } catch {
      toast.show(t('testPushError'))
    } finally { setTestBusy(false) }
  }

  const { upcoming, past } = splitReminders(reminders.items)

  const resetForm = () => { setText(''); setTimes([defaultWhen()]); setEditingId(null); setErr('') }

  const setTimeAt = (i, v) => setTimes(ts => ts.map((x, j) => j === i ? v : x))
  const addTime = () => setTimes(ts => ts.length < MAX_TIMES ? [...ts, defaultWhen()] : ts)
  const removeTime = (i) => setTimes(ts => ts.length > 1 ? ts.filter((_, j) => j !== i) : ts)

  const save = () => {
    if (!text.trim()) { setErr(t('required')); return }
    const isoTimes = times.map(inputToIso).filter(Boolean)
    if (!isoTimes.length) { setErr(t('required')); return }
    const fields = buildReminderFields(text.trim(), isoTimes)
    if (editingId) { reminders.patch(editingId, fields); toast.show(t('savedToast')) }
    else { reminders.add({ ...fields, done: false }); toast.show(t('reminderSet')) }
    resetForm()
  }

  const startEdit = (r) => {
    setEditingId(r.id)
    setText(r.text || '')
    const ts = reminderTimes(r).map(isoToInput).filter(Boolean)
    setTimes(ts.length ? ts : [defaultWhen()])
    setErr('')
    try { window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { /* ignore */ }
  }

  const askPermission = async () => { setPerm(await requestNotificationPermission()) }

  const whenLabel = (iso) => `${relativeDay(iso, lang)} · ${fmtTime(iso, lang)}`

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

        {/* Add / edit */}
        <Card className="stack" style={{ marginTop: 12 }}>
          {editingId && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{t('editReminder')}</span>
              <button className="link-btn" style={{ color: 'var(--ink-3)', fontSize: 13 }} onClick={resetForm}>{t('cancel')}</button>
            </div>
          )}
          <Field label={t('reminderWhat')} required error={err}>
            <Input value={text} onChange={e => setText(e.target.value)} placeholder={t('reminderWhatPlaceholder')} autoFocus={!editingId}
              onKeyDown={e => { if (e.key === 'Enter') save() }} />
          </Field>
          {times.map((when, i) => (
            <Field key={i} label={i === 0 ? t('reminderWhen') : `${t('reminderWhen')} ${i + 1}`}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Input type="datetime-local" value={when} onChange={e => setTimeAt(i, e.target.value)} style={{ flex: 1 }} />
                {times.length > 1 && (
                  <button className="iconbtn" aria-label={t('delete')} onClick={() => removeTime(i)}><Icon name="x" size={16} /></button>
                )}
              </div>
            </Field>
          ))}
          {times.length < MAX_TIMES && (
            <button className="link-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--brand-600)', fontSize: 13.5 }} onClick={addTime}>
              <Icon name="plus" size={15} /> {t('addAnotherTime')}
            </button>
          )}
          <div className="chip-row">
            {presets().map(p => (
              <Chip key={p.key} selectable on={times[0] === p.when} onClick={() => setTimeAt(0, p.when)}>{t(p.key)}</Chip>
            ))}
          </div>
          <Button block variant="primary" icon={editingId ? 'check' : 'bell'} onClick={save}>{editingId ? t('save') : t('addReminder')}</Button>
        </Card>

        {/* Lists */}
        {upcoming.length === 0 && past.length === 0 ? (
          <Empty icon="bell" title={t('noReminders')} text={t('remindersHint')} />
        ) : (
          <>
            {upcoming.length > 0 && <h2 className="member-h2" style={{ marginTop: 18 }}>{t('upcoming')}</h2>}
            {upcoming.map(r => {
              const more = pendingCount(r) - 1
              return (
                <SwipeRow key={r.id} onDelete={() => { reminders.remove(r.id); toast.show(t('deletedToast')) }}>
                  <div className="li" onClick={() => startEdit(r)}>
                    <div className="lead t-brand"><Icon name="bell" size={16} /></div>
                    <div className="body">
                      <div className="title">{r.text}</div>
                      <div className="meta">{whenLabel(nextPendingTime(r))}{more > 0 ? ` · +${more} ${t('moreTimes')}` : ''}</div>
                    </div>
                    <button className="iconbtn" aria-label={t('markComplete')} onClick={e => { e.stopPropagation(); reminders.patch(r.id, { done: true }); toast.show('✓') }}><Icon name="check" size={16} /></button>
                  </div>
                </SwipeRow>
              )
            })}

            {past.length > 0 && <h2 className="member-h2" style={{ marginTop: 18 }}>{t('past')}</h2>}
            {past.map(r => (
              <SwipeRow key={r.id} onDelete={() => { reminders.remove(r.id); toast.show(t('deletedToast')) }}>
                <div className="li" style={{ opacity: 0.6 }} onClick={() => startEdit(r)}>
                  <div className={`lead ${r.done ? 't-ok' : 't-warn'}`}><Icon name={r.done ? 'check' : 'clock'} size={16} /></div>
                  <div className="body">
                    <div className="title" style={{ textDecoration: r.done ? 'line-through' : 'none' }}>{r.text}</div>
                    <div className="meta">{fmtDate(lastTime(r), lang)} · {fmtTime(lastTime(r), lang)}</div>
                  </div>
                  {!r.done && <button className="iconbtn" aria-label={t('markComplete')} onClick={e => { e.stopPropagation(); reminders.patch(r.id, { done: true }) }}><Icon name="check" size={16} /></button>}
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
