import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Section, Empty } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'
import { isOverdue, isToday, daysUntil, relativeDay } from '../../lib/format.js'
import { taskMemberIds } from '../../lib/org.js'

// A read-only overview of work: open/overdue counts, boss items, per-department
// load and per-member workload.
export default function WorkDashboardScreen({ go }) {
  const { t, lang } = useT()
  const departments = useCollection('departments')
  const members = useCollection('members')
  const tasks = useCollection('tasks')

  const d = useMemo(() => {
    const work = tasks.items.filter(x => x.classification === 'work' && x.status !== 'cancelled')
    const open = work.filter(x => x.status !== 'completed')
    const overdue = open.filter(x => isOverdue(x.dueDate))
    const thisWeek = open.filter(x => { const dd = daysUntil(x.dueDate); return dd != null && dd >= 0 && dd <= 7 })
    const boss = open.filter(x => x.boss)
    const byDept = departments.items.map(dep => ({
      dep,
      open: open.filter(x => x.departmentId === dep.id).length,
      overdue: overdue.filter(x => x.departmentId === dep.id).length,
    })).sort((a, b) => b.open - a.open)
    const byMember = members.items.map(m => ({
      m,
      open: open.filter(x => taskMemberIds(x).includes(m.id)).length,
      overdue: overdue.filter(x => taskMemberIds(x).includes(m.id)).length,
    })).filter(x => x.open > 0).sort((a, b) => b.open - a.open)
    // Per-member scorecards: completion, on-time %, and current load. A task
    // counts as on-time if it had no due date or was completed on/before it
    // (completion time approximated by the record's updatedAt).
    const scorecards = members.items.map(m => {
      const assigned = work.filter(x => taskMemberIds(x).includes(m.id))
      if (!assigned.length) return null
      const done = assigned.filter(x => x.status === 'completed')
      const onTime = done.filter(x => !x.dueDate || (x.updatedAt && x.updatedAt.slice(0, 10) <= x.dueDate)).length
      const openC = assigned.filter(x => x.status !== 'completed').length
      const overdueC = assigned.filter(x => x.status !== 'completed' && isOverdue(x.dueDate)).length
      const pct = done.length ? Math.round(onTime / done.length * 100) : null
      return { m, done: done.length, onTime, open: openC, overdue: overdueC, pct }
    }).filter(Boolean).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.done - a.done)
    return { open, overdue, thisWeek, boss, byDept, byMember, scorecards }
  }, [tasks.items, departments.items, members.items])

  const maxLoad = d.byMember[0]?.open || 1

  return (
    <>
      <DetailHeader title={t('workDashboard')} onBack={() => go('work')} />
      <div className="screen">
        <div className="stat-grid" style={{ marginTop: 14 }}>
          <Stat label={t('openTasks')} value={String(d.open.length)} />
          <Stat label={t('overdue')} value={String(d.overdue.length)} sub={d.overdue.length ? t('needsAttention') : ''} />
          <Stat label={t('dueThisWeek')} value={String(d.thisWeek.length)} />
          <Stat label={t('withBoss')} value={String(d.boss.length)} onClick={() => go('work')} />
        </div>

        {d.byDept.length > 0 && (
          <>
            <Section title={t('byDepartment')} />
            <Card tight>
              {d.byDept.map(({ dep, open, overdue }) => (
                <div className="li" key={dep.id} onClick={() => go(`work/${dep.id}`)}>
                  <div className="lead t-brand"><Icon name="report" size={18} /></div>
                  <div className="body"><div className="title">{dep.name}</div><div className="meta">{open} {t('tasksLower')}{overdue > 0 ? ` · ${overdue} ${t('overdue').toLowerCase()}` : ''}</div></div>
                  <b className="tnum">{open}</b>
                </div>
              ))}
            </Card>
          </>
        )}

        {d.scorecards.length > 0 && (
          <>
            <Section title={t('teamScorecards')} />
            <Card tight>
              {d.scorecards.map(({ m, done, open, overdue, pct }) => {
                const tint = pct == null ? 'muted' : pct >= 80 ? 't-ok' : pct >= 50 ? 't-warn' : 't-danger'
                return (
                  <div className="li" key={m.id}>
                    <div className="lead" style={{ background: 'var(--surface-2)' }}><Icon name="people" size={17} /></div>
                    <div className="body">
                      <div className="title">{m.name}</div>
                      <div className="meta">{done} {t('doneLabel')} · {open} {t('openLabel').toLowerCase()}{overdue > 0 && <span className="t-danger"> · {overdue} {t('overdue').toLowerCase()}</span>}</div>
                    </div>
                    <div style={{ textAlign: 'end' }}>
                      <b className={`tnum ${tint}`} style={{ fontSize: 16 }}>{pct == null ? '—' : `${pct}%`}</b>
                      <div className="muted" style={{ fontSize: 10.5 }}>{t('onTime')}</div>
                    </div>
                  </div>
                )
              })}
            </Card>
          </>
        )}

        <Section title={t('memberWorkload')} />
        {d.byMember.length === 0 ? (
          <Empty icon="people" title={t('nothingHere')} text={t('workloadHint')} />
        ) : (
          <Card className="stack">
            {d.byMember.map(({ m, open, overdue }) => (
              <div key={m.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{m.name}</span>
                  <span className="muted">{open} {t('tasksLower')}{overdue > 0 ? ` · ` : ''}{overdue > 0 && <span className="t-danger">{overdue} {t('overdue').toLowerCase()}</span>}</span>
                </div>
                <div style={{ height: 7, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(6, open / maxLoad * 100)}%`, background: overdue > 0 ? 'var(--warn)' : 'var(--brand-500, var(--brand-400))', borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </>
  )
}
