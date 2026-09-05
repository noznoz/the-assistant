import React, { useState, useEffect, useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { Card, Button, Empty, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { fmtDate, relativeDay, isOverdue, todayISO } from '../../lib/format.js'
import * as cloud from '../../lib/cloud.js'
import PersonEditor from '../people/PersonEditor.jsx'

// The whole app for a family member: just their profile and the tasks assigned
// to them. Everything else in the household never reaches their device.
export default function MemberShell() {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const people = useCollection('people')
  const tasks = useCollection('tasks')
  const toast = useToast()
  const [tab, setTab] = useState('tasks')
  const [editing, setEditing] = useState(false)

  const user = cloud.currentUser() || {}
  const emailName = (user.email || '').split('@')[0]

  // The member is represented by a people record carrying their userId. Create
  // it on first run so the admin can see them and assign them tasks.
  const me = useMemo(() => people.items.find(p => p.userId === user.id), [people.items, user.id])
  useEffect(() => {
    if (user.id && !me) people.add({ userId: user.id, email: user.email || '', name: emailName || 'Me', relationship: 'family' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, me])

  const mine = tasks.items.filter(x =>
    (x.assigneeUserId && x.assigneeUserId === user.id) ||
    (me && x.assigneeId === me.id) ||
    (me && x.assignedTo && x.assignedTo === me.name))
  const open = mine.filter(x => x.status !== 'completed' && x.status !== 'cancelled')
    .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'))
  const done = mine.filter(x => x.status === 'completed')

  const complete = (x) => { tasks.patch(x.id, { status: 'completed', completedAt: todayISO() }); toast.show('✓ ' + t('markComplete')) }
  const reopen = (x) => { tasks.patch(x.id, { status: 'in_progress' }) }

  const name = (me && me.name) || emailName
  const initials = (name || 'M').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()

  return (
    <div className="app member">
      <header className="member-top">
        <div>
          <div className="member-hello">{t('memberHello')}, {name}</div>
          <div className="member-role"><Icon name="people" size={12} /> {t('familyMember')}</div>
        </div>
        <button className="iconbtn" aria-label={t('signOut')} onClick={() => { cloud.signOut(); window.location.hash = '#/login' }}>
          <Icon name="x" size={18} />
        </button>
      </header>

      <div className="screen" style={{ paddingBottom: 90 }}>
        {tab === 'tasks' ? (
          <>
            <h2 className="member-h2">{t('myTasks')}</h2>
            {open.length === 0 && done.length === 0 ? (
              <Empty icon="check" title={t('memberTasksNone')} text={t('memberTasksNoneHint')} />
            ) : (
              <>
                {open.map(x => (
                  <div className="li" key={x.id}>
                    <button className="lead t-brand member-check" aria-label={t('markComplete')} onClick={() => complete(x)}
                      style={{ borderRadius: '50%', border: '2px solid var(--brand-600)', background: 'transparent' }} />
                    <div className="body">
                      <div className="title">{x.title}</div>
                      <div className="meta">
                        {x.priority && x.priority !== 'medium' && <span className={`chip ${x.priority === 'high' || x.priority === 'critical' ? 't-danger' : ''}`} style={{ padding: '1px 7px' }}>{t(x.priority) || x.priority}</span>}
                        {x.dueDate && <span className={isOverdue(x.dueDate) ? 't-danger' : ''}>{isOverdue(x.dueDate) ? t('overdue') + ' · ' : ''}{relativeDay(x.dueDate, lang)}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {done.length > 0 && <h2 className="member-h2" style={{ marginTop: 20 }}>{t('completed')}</h2>}
                {done.map(x => (
                  <div className="li" key={x.id} style={{ opacity: 0.6 }}>
                    <button className="lead t-ok" aria-label={t('reopen') || 'Reopen'} onClick={() => reopen(x)}
                      style={{ borderRadius: '50%', color: 'var(--ok, #3a9)' }}><Icon name="check" size={16} /></button>
                    <div className="body"><div className="title" style={{ textDecoration: 'line-through' }}>{x.title}</div></div>
                  </div>
                ))}
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="member-h2">{t('myProfile')}</h2>
            <Card style={{ textAlign: 'center' }}>
              <div className="member-avatar">
                {me && me.photo ? <img src={me.photo} alt="" /> : <span>{initials}</span>}
              </div>
              <div style={{ fontWeight: 750, fontSize: 18, marginTop: 10 }}>{name}</div>
              {me && me.jobTitle && <div className="muted" style={{ fontSize: 13 }}>{me.jobTitle}</div>}
              <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{user.email}</div>
              <div style={{ marginTop: 14 }}>
                <Button variant="primary" icon="cog" onClick={() => setEditing(true)}>{t('editProfile')}</Button>
              </div>
            </Card>
            {me && (me.mobile || me.birthday) && (
              <Card className="stack" style={{ marginTop: 12 }}>
                {me.mobile && <div className="li" style={{ margin: 0 }}><div className="lead t-brand"><Icon name="phone" size={16} /></div><div className="body"><div className="title">{me.mobile}</div><div className="meta">{t('mobile')}</div></div></div>}
                {me.birthday && <div className="li" style={{ margin: 0 }}><div className="lead t-brand"><Icon name="cake" size={16} /></div><div className="body"><div className="title">{fmtDate(me.birthday, lang, settings.dateFormat)}</div><div className="meta">{t('birthday')}</div></div></div>}
              </Card>
            )}
          </>
        )}
      </div>

      <nav className="member-nav">
        <button className={tab === 'tasks' ? 'on' : ''} onClick={() => setTab('tasks')}>
          <Icon name="today" size={20} /><span>{t('myTasks')}</span>
          {open.length > 0 && <b className="member-badge">{open.length}</b>}
        </button>
        <button className={tab === 'profile' ? 'on' : ''} onClick={() => setTab('profile')}>
          <Icon name="people" size={20} /><span>{t('myProfile')}</span>
        </button>
      </nav>

      {editing && me && (
        <PersonEditor initial={me} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); toast.show(t('savedToast')) }} />
      )}
      {toast.node}
    </div>
  )
}
