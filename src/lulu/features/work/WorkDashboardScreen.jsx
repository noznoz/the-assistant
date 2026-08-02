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
    return { open, overdue, thisWeek, boss, byDept, byMember }
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
