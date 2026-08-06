import React, { useState, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore } from '../../store/StoreProvider.jsx'
import * as cloud from '../../lib/cloud.js'

// The SQL a user runs once in their Supabase project's SQL editor.
const SETUP_SQL = `-- The Assistant — cloud sync + family. Run once in Supabase → SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text,
  created_at timestamptz default now()
);
create table if not exists public.household_members (
  household_id uuid references public.households on delete cascade,
  user_id uuid references auth.users on delete cascade,
  email text, role text default 'member',
  created_at timestamptz default now(),
  primary key (household_id, user_id)
);
create table if not exists public.records (
  household_id uuid references public.households on delete cascade,
  id text not null,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, id)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.records enable row level security;

-- Is the current user a member of this household?
create or replace function public.is_member(h uuid) returns boolean
language sql security definer stable as $$
  select exists(select 1 from public.household_members
    where household_id = h and user_id = auth.uid());
$$;

create policy hm_self_read on public.household_members
  for select using (user_id = auth.uid() or public.is_member(household_id));
create policy hm_self_join on public.household_members
  for insert with check (user_id = auth.uid());
create policy hh_member_read on public.households
  for select using (public.is_member(id));
create policy hh_create on public.households
  for insert with check (true);
create policy rec_member_all on public.records
  for all using (public.is_member(household_id))
  with check (public.is_member(household_id));`

export default function CloudScreen({ go }) {
  const { t } = useT()
  const { cloudSync } = useStore()
  const toast = useToast()
  const [, force] = useState(0)
  useEffect(() => cloud.onStatus(() => force(n => n + 1)), [])

  const [url, setUrl] = useState((cloud.getConfig() || {}).url || '')
  const [anonKey, setAnonKey] = useState((cloud.getConfig() || {}).anonKey || '')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [members, setMembers] = useState([])
  const [showSql, setShowSql] = useState(false)
  const [consent, setConsent] = useState(cloud.hasConsent())

  const configured = cloud.isConfigured()
  const signedIn = cloud.isSignedIn()

  const toggleConsent = (v) => { setConsent(v); cloud.setConsent(v) }

  useEffect(() => { if (signedIn) cloud.listMembers().then(setMembers) }, [signedIn])

  const saveConfig = () => {
    cloud.setConfig(url, anonKey)
    if (cloud.isConfigured()) toast.show(t('savedToast')); else toast.show(t('cloudNeedBoth'))
  }
  const disconnect = () => { cloud.signOut(); cloud.setConfig('', ''); cloud.setConsent(false); setConsent(false); setUrl(''); setAnonKey('') }

  const auth = async (kind) => {
    setErr(''); setBusy(true)
    try {
      if (kind === 'up') await cloud.signUp(email, pass)
      else await cloud.signIn(email, pass)
      setPass('')
      await cloudSync()
      cloud.listMembers().then(setMembers)
      toast.show(t('cloudConnected'))
    } catch (e) { setErr(e.message || t('aiError')) } finally { setBusy(false) }
  }

  const doSync = async () => { setBusy(true); try { await cloudSync(); toast.show(t('cloudSynced')) } finally { setBusy(false) } }

  const doJoin = async () => {
    setErr(''); setBusy(true)
    try { await cloud.joinHousehold(joinCode); setJoinCode(''); await cloudSync(); cloud.listMembers().then(setMembers); toast.show(t('cloudJoined')) }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const copy = (text) => { navigator.clipboard?.writeText(text); toast.show(t('copied')) }

  return (
    <>
      <DetailHeader title={t('cloudFamily')} onBack={() => go('more')} />
      <div className="screen">

        {/* Connection */}
        <Section title={t('cloudConnection')} />
        <Card className="stack">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className={`lead ${signedIn ? 't-ok' : configured ? 't-warn' : 't-info'}`}
              style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center' }}>
              <Icon name={signedIn ? 'globe' : 'globe'} size={18} />
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{signedIn ? t('cloudOn') : configured ? t('cloudNotSignedIn') : t('cloudOff')}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {signedIn ? (cloud.currentUser()?.email || '') : t('cloudOffHint')}
              </div>
            </div>
          </div>
        </Card>

        {/* Project config */}
        {!signedIn && (
          <>
            <Section title={t('cloudProject')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('cloudProjectHint')}</p>
              <Field label={t('cloudUrl')}><Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoCapitalize="off" spellCheck={false} /></Field>
              <Field label={t('cloudAnonKey')}><Input type="password" value={anonKey} onChange={e => setAnonKey(e.target.value)} placeholder="eyJhbGciOi…" autoComplete="off" spellCheck={false} /></Field>
              <Button block variant="primary" icon="check" onClick={saveConfig}>{t('cloudSaveProject')}</Button>
              <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowSql(s => !s)}>{showSql ? t('cloudHideSql') : t('cloudShowSql')}</button>
              {showSql && (
                <>
                  <p className="hint" style={{ margin: '0 2px' }}>{t('cloudSqlHint')}</p>
                  <pre style={{ maxHeight: 220, overflow: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, fontSize: 11, lineHeight: 1.45 }}>{SETUP_SQL}</pre>
                  <Button icon="copy" onClick={() => copy(SETUP_SQL)}>{t('cloudCopySql')}</Button>
                </>
              )}
            </Card>
          </>
        )}

        {/* Sign in / up */}
        {configured && !signedIn && (
          <>
            <Section title={t('cloudSignIn')} />
            <Card className="stack">
              <Field label={t('email')}><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" autoCapitalize="off" spellCheck={false} /></Field>
              <Field label={t('password')}><Input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="••••••••" /></Field>
              <label className="consent-row">
                <input type="checkbox" checked={consent} onChange={e => toggleConsent(e.target.checked)} />
                <span>{t('cloudConsent')}</span>
              </label>
              {err && <p className="err" style={{ margin: '0 2px' }}>{err}</p>}
              <div className="row2">
                <Button variant="primary" onClick={() => auth('in')} disabled={busy || !email || !pass || !consent}>{t('signIn')}</Button>
                <Button onClick={() => auth('up')} disabled={busy || !email || !pass || !consent}>{t('createAccount')}</Button>
              </div>
            </Card>
          </>
        )}

        {/* Signed-in controls */}
        {signedIn && (
          <>
            <Section title={t('cloudSync')} />
            <Card className="stack">
              <Button block variant="primary" icon="refresh" onClick={doSync} disabled={busy}>{busy ? t('thinking') + '…' : t('cloudSyncNow')}</Button>
              <p className="hint" style={{ margin: '0 2px' }}>{t('cloudSyncHint')}</p>
            </Card>

            <Section title={t('cloudFamilyMembers')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('cloudInviteHint')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 12, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10 }}>{cloud.householdId()}</div>
                <Button icon="copy" onClick={() => copy(cloud.householdId())}>{t('copy')}</Button>
              </div>
              {members.length > 0 && members.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <Icon name="people" size={15} style={{ color: 'var(--ink-3)' }} />
                  <span style={{ flex: 1 }}>{m.email}</span>
                  <span className="chip">{m.role}</span>
                </div>
              ))}
            </Card>

            <Section title={t('cloudJoin')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('cloudJoinHint')}</p>
              <Field label={t('cloudCode')}><Input value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="household code" autoCapitalize="off" spellCheck={false} /></Field>
              {err && <p className="err" style={{ margin: '0 2px' }}>{err}</p>}
              <Button block icon="people" onClick={doJoin} disabled={busy || !joinCode.trim()}>{t('cloudJoinBtn')}</Button>
            </Card>

            <Section title={t('cloudAccount')} />
            <Card className="stack">
              <Button block icon="x" onClick={() => { cloud.signOut() }}>{t('signOut')}</Button>
            </Card>
          </>
        )}

        <div style={{ height: 8 }} />
        {configured && (
          <Button block variant="danger" icon="trash" onClick={disconnect}>{t('cloudDisconnect')}</Button>
        )}
        <p className="center muted" style={{ marginTop: 18, fontSize: 12 }}>{t('cloudPrivacy')}</p>
      </div>
      {toast.node}
    </>
  )
}
