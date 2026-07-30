import React, { useMemo } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Chip, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useCollection, useSettings } from '../../store/StoreProvider.jsx'
import { money } from '../../lib/format.js'
import { accountStats } from '../../lib/accounts.js'
import { investmentValue, totalLiabilities } from '../../lib/networth.js'
import { hijriDate } from '../../lib/prayer.js'
import { share } from '../../lib/share.js'

const ZAKAT_RATE = 0.025
const NISAB_GRAMS = 85 // 85g of gold

export default function ZakatScreen({ go }) {
  const { t, lang } = useT()
  const { settings, updateSettings } = useSettings()
  const cur = settings.currency
  const rates = settings.rates
  const accounts = useCollection('accounts')
  const income = useCollection('income')
  const expenses = useCollection('expenses')
  const investments = useCollection('investments')

  const z = settings.zakat || {}
  const goldPrice = Number(z.goldPrice) || 300
  const goldGrams = Number(z.goldGrams) || 0
  const extraCash = Number(z.extraCash) || 0
  const includeRealEstate = !!z.includeRealEstate
  const setZ = (k, v) => updateSettings({ zakat: { ...z, [k]: v } })

  const calc = useMemo(() => {
    const cash = accounts.items.reduce((s, a) => s + accountStats(a, income.items, expenses.items, rates).remaining, 0)
    const invest = investments.items
      .filter(v => includeRealEstate || v.type !== 'realestate')
      .reduce((s, v) => s + investmentValue(v, rates), 0)
    const gold = goldGrams * goldPrice
    const liabilities = totalLiabilities(expenses.items, rates)
    const base = Math.max(0, cash + invest + gold + extraCash - liabilities)
    const nisab = NISAB_GRAMS * goldPrice
    const due = base >= nisab ? base * ZAKAT_RATE : 0
    return { cash, invest, gold, liabilities, base, nisab, due, meetsNisab: base >= nisab }
  }, [accounts.items, investments.items, income.items, expenses.items, rates, goldPrice, goldGrams, extraCash, includeRealEstate])

  const shareStatement = () => {
    const L = lang === 'ar'
    share([
      L ? '🕌 حساب الزكاة' : '🕌 Zakat',
      `${L ? 'الوعاء الزكوي' : 'Zakatable wealth'}: ${money(calc.base, cur, lang)}`,
      `${L ? 'النصاب' : 'Nisab'}: ${money(calc.nisab, cur, lang)}`,
      `${L ? 'الزكاة (2.5%)' : 'Zakat (2.5%)'}: ${money(calc.due, cur, lang)}`,
    ].join('\n'))
  }

  const Row = ({ k, v, minus }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0' }}>
      <span className="muted">{k}</span>
      <b className="tnum">{minus ? '− ' : ''}{money(v, cur, lang)}</b>
    </div>
  )

  return (
    <>
      <DetailHeader title={t('zakat')} onBack={() => go('expenses')} right={
        <button className="iconbtn" onClick={shareStatement} aria-label={t('share')}><Icon name="share" size={18} /></button>
      } />
      <div className="screen">
        <Card style={{ textAlign: 'center', marginTop: 14 }}>
          <div className="muted" style={{ fontSize: 12, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('zakatDue')} · 2.5%</div>
          <div style={{ fontSize: 36, fontWeight: 780, marginTop: 4 }} className="tnum t-brand">{money(calc.due, cur, lang)}</div>
          <div className={`muted ${calc.meetsNisab ? 't-ok' : ''}`} style={{ fontSize: 12, marginTop: 4 }}>
            {calc.meetsNisab ? t('meetsNisab') : t('belowNisab')} · {t('nisab')} {money(calc.nisab, cur, lang)}
          </div>
          {hijriDate(new Date(), lang) && <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{hijriDate(new Date(), lang)}</div>}
        </Card>

        <Section title={t('zakatableWealth')} />
        <Card>
          <Row k={t('cashInAccounts')} v={calc.cash} />
          <Row k={t('investments')} v={calc.invest} />
          {calc.gold > 0 && <Row k={t('goldValue')} v={calc.gold} />}
          {extraCash > 0 && <Row k={t('otherCash')} v={extraCash} />}
          {calc.liabilities > 0 && <Row k={t('debtsInstallments')} v={calc.liabilities} minus />}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
            <b>{t('zakatableTotal')}</b><b className="tnum">{money(calc.base, cur, lang)}</b>
          </div>
        </Card>

        <Section title={t('adjustInputs')} />
        <Card className="stack">
          <div className="row2">
            <Field label={t('goldGrams')}><Input type="number" inputMode="decimal" value={z.goldGrams ?? ''} onChange={e => setZ('goldGrams', e.target.value)} placeholder="0" /></Field>
            <Field label={t('goldPricePerGram')} hint={cur}><Input type="number" inputMode="decimal" value={z.goldPrice ?? ''} onChange={e => setZ('goldPrice', e.target.value)} placeholder="300" /></Field>
          </div>
          <Field label={t('otherCashGold')}><Input type="number" inputMode="decimal" value={z.extraCash ?? ''} onChange={e => setZ('extraCash', e.target.value)} placeholder="0" /></Field>
          <div className="chip-row">
            <Chip selectable on={includeRealEstate} onClick={() => setZ('includeRealEstate', !includeRealEstate)}>{t('includeRealEstate')}</Chip>
          </div>
          <p className="hint" style={{ margin: '0 2px' }}>{t('zakatHint')}</p>
        </Card>

        <Button block variant="brand" icon="whatsapp" style={{ marginTop: 16 }} onClick={shareStatement}>{t('shareStatement')}</Button>
        <p className="center muted" style={{ marginTop: 12, fontSize: 11 }}>{t('zakatDisclaimer')}</p>
      </div>
    </>
  )
}
