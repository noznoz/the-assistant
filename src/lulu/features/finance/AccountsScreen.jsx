import React, { useState } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Stat, Sheet, Field, Input, Select, Chip, Button, Empty, Fab, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { ACCOUNT_TYPES, findAccountType, label } from '../../lib/domain.js'
import { money } from '../../lib/format.js'
import { accountStats } from '../../lib/accounts.js'
import SwipeRow from '../../ui/SwipeRow.jsx'

export default function AccountsScreen({ go }) {
  const { t, lang } = useT()
  const { settings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const accounts = useCollection('accounts')
  const income = useCollection('income')
  const expenses = useCollection('expenses')
  const [editor, setEditor] = useState(null)
  const toast = useToast()

  const stat = (a) => accountStats(a, income.items, expenses.items, rates)
  const totalRemaining = accounts.items.reduce((s, a) => s + stat(a).remaining, 0)
  const netRemaining = accounts.items.filter(a => a.includeInNet !== false).reduce((s, a) => s + stat(a).remaining, 0)

  return (
    <>
      <DetailHeader title={t('accounts')} onBack={() => go('expenses')} />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('totalBalance')}</div>
          <div style={{ fontSize: 32, fontWeight: 780, marginTop: 4 }} className="tnum">{money(totalRemaining, cur, lang)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{t('inNet')}: {money(netRemaining, cur, lang)}</div>
        </Card>

        {accounts.items.length === 0 ? (
          <Empty icon="wallet" title={t('noAccounts')} text={t('accountsHint')}
            action={<Button variant="primary" icon="plus" onClick={() => setEditor({})}>{t('newAccount')}</Button>} />
        ) : (
          <div style={{ marginTop: 14 }}>
            {accounts.items.map(a => {
              const s = stat(a)
              const type = findAccountType(a.type)
              return (
                <SwipeRow key={a.id} onEdit={() => setEditor(a)} onDelete={() => { accounts.remove(a.id); toast.show(t('deletedToast')) }}>
                <Card className="tight" onClick={() => setEditor(a)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="lead t-brand" style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}><Icon name={type?.icon || 'wallet'} size={18} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {a.name}
                        {a.isDefault && <span className="chip t-ok" style={{ padding: '0 6px' }}>{t('defaultLabel')}</span>}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>{type ? label(type, lang) : ''}{a.includeInNet === false ? ` · ${t('excludedFromNet')}` : ''}</div>
                    </div>
                    <b className="tnum">{money(s.remaining, cur, lang)}</b>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <span className="chip" style={{ flex: 1, justifyContent: 'space-between' }}>{t('creditIn')} <b className="tnum t-ok">{money(s.credits, cur, lang)}</b></span>
                    <span className="chip" style={{ flex: 1, justifyContent: 'space-between' }}>{t('debitOut')} <b className="tnum t-danger">{money(s.debits, cur, lang)}</b></span>
                  </div>
                </Card>
                </SwipeRow>
              )
            })}
          </div>
        )}
      </div>
      <Fab onClick={() => setEditor({})} />
      {editor && <AccountEditor initial={editor.id ? editor : {}} accounts={accounts} onClose={() => setEditor(null)} onSaved={() => toast.show(t('savedToast'))} />}
      {toast.node}
    </>
  )
}

function AccountEditor({ initial, accounts, onClose, onSaved }) {
  const { t, lang } = useT()
  const [f, setF] = useState({ name: '', type: 'current', openingBalance: '', includeInNet: true, isDefault: false, ...initial })
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = () => {
    if (!f.name.trim()) { setErr(t('required')); return }
    const rec = { ...f, name: f.name.trim(), openingBalance: parseFloat(f.openingBalance) || 0 }
    // Only one default account at a time.
    if (rec.isDefault) accounts.items.forEach(a => { if (a.id !== initial.id && a.isDefault) accounts.patch(a.id, { isDefault: false }) })
    initial.id ? accounts.save({ ...rec, id: initial.id }) : accounts.add(rec)
    onSaved && onSaved(); onClose()
  }

  return (
    <Sheet title={initial.id ? t('editAccount') : t('newAccount')} onClose={onClose}
      footer={<div className="stack">
        <Button variant="primary" block onClick={submit}>{t('save')}</Button>
        {initial.id && <Button block variant="danger" icon="trash" onClick={() => { accounts.remove(initial.id); onClose() }}>{t('delete')}</Button>}
      </div>}>
      <Field label={t('accountName')} required error={err}><Input value={f.name} onChange={set('name')} placeholder="Salary account, Savings…" autoFocus /></Field>
      <div className="row2">
        <Field label={t('accountType')}>
          <Select value={f.type} onChange={set('type')} options={ACCOUNT_TYPES.map(s => ({ value: s.id, label: label(s, lang) }))} />
        </Field>
        <Field label={t('openingBalance')}><Input type="number" inputMode="decimal" value={f.openingBalance} onChange={set('openingBalance')} placeholder="0" /></Field>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div className="chip-row">
          <Chip selectable on={f.includeInNet !== false} onClick={() => setF({ ...f, includeInNet: !(f.includeInNet !== false) })}>{t('includeInNet')}</Chip>
          <Chip selectable on={!!f.isDefault} onClick={() => setF({ ...f, isDefault: !f.isDefault })}>{t('defaultForExpenses')}</Chip>
        </div>
      </div>
      <p className="hint" style={{ margin: '0 2px' }}>{t('accountEditorHint')}</p>
    </Sheet>
  )
}
