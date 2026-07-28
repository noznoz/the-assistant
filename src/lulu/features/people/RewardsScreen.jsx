import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Sheet, Field, Input, Button, Empty, Fab, Chip, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection } from '../../store/StoreProvider.jsx'

export default function RewardsScreen({ go }) {
  const { t } = useT()
  const rewards = useCollection('rewards')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  return (
    <>
      <DetailHeader title={t('rewardsStore')} onBack={() => go('people')} />
      <div className="screen">
        {rewards.items.length === 0 ? (
          <Empty icon="gift" title={t('noRewards')} text={t('rewardsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newReward')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {rewards.items.map(r => (
              <div className="li" key={r.id} onClick={() => setEditor(r)}>
                <div className="lead t-brand"><Icon name="gift" size={18} /></div>
                <div className="body">
                  <div className="title">{r.name}</div>
                  {r.note && <div className="meta">{r.note}</div>}
                </div>
                <Chip tint="t-brand"><Icon name="sparkle" size={12} /> {Number(r.cost) || 0} {t('pts')}</Chip>
              </div>
            ))}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <RewardEditor initial={editor.id ? editor : {}} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function RewardEditor({ initial, onClose, onSaved }) {
  const { t } = useT()
  const rewards = useCollection('rewards')
  const [f, setF] = useState({ name: '', cost: '', note: '', ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    if (!f.name.trim() || !(parseInt(f.cost) > 0)) { setErr(t('required')); return }
    const rec = { ...f, cost: parseInt(f.cost) }
    initial.id ? rewards.save({ ...rec, id: initial.id }) : rewards.add(rec)
    onSaved && onSaved(); onClose()
  }
  return (
    <Sheet title={initial.id ? t('edit') : t('newReward')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { rewards.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('title')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Extra screen time, an outing…" autoFocus /></Field>
      <Field label={t('rewardCost')} required><Input type="number" inputMode="numeric" value={f.cost} onChange={set('cost')} placeholder="10" /></Field>
      <Field label={t('notesField')}><Input value={f.note} onChange={set('note')} /></Field>
    </Sheet>
  )
}

// Redeem sheet used from a person's profile.
export function RedeemSheet({ person, onClose, onRedeem }) {
  const { t } = useT()
  const rewards = useCollection('rewards')
  const points = Number(person.points) || 0
  return (
    <Sheet title={t('redeemReward')} onClose={onClose}>
      <div className="muted" style={{ marginBottom: 12 }}>{person.name} · {points} {t('pts')}</div>
      {rewards.items.length === 0 ? (
        <Empty icon="gift" title={t('noRewards')} text={t('rewardsHint')} />
      ) : (
        <div className="stack">
          {rewards.items.map(r => {
            const cost = Number(r.cost) || 0
            const can = points >= cost
            return (
              <div className="li" key={r.id} style={{ margin: 0, opacity: can ? 1 : 0.5 }}>
                <div className="lead t-brand"><Icon name="gift" size={18} /></div>
                <div className="body"><div className="title">{r.name}</div><div className="meta">{cost} {t('pts')}</div></div>
                <button className="btn sm primary" disabled={!can} onClick={() => onRedeem(r, cost)}>{t('redeem')}</button>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
