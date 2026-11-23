import React, { useState, useEffect, useRef } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Card, Section, Field, Input, Button, useToast } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore } from '../../store/StoreProvider.jsx'
import * as cloud from '../../lib/cloud.js'
import { CLAUDE_SQL } from '../../lib/claudeSql.js'
import { STORAGE_SQL } from '../../lib/storageSql.js'
import { pendingUploads, syncAttachments } from '../../lib/files.js'

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
  with check (public.is_member(household_id));` + '\n\n' + STORAGE_SQL

export default function CloudScreen({ go, param }) {
  const { t, lang } = useT()
  const { cloudSync, removeSampleData } = useStore()
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
  // Claude connector
  const [keys, setKeys] = useState([])
  const [newLink, setNewLink] = useState('')     // shown once, right after it's made
  const [needSetup, setNeedSetup] = useState(false)
  const [showClaudeSql, setShowClaudeSql] = useState(false)

  // Opened from a "Use on another device" link: fill the project in, take the
  // key out of the address bar, and leave only "sign in".
  // Kept for the tab's session so it survives the screen being re-created.
  const LINK_FLAG = 'lulu:fromDeviceLink'
  const flag = (v) => { try { v ? sessionStorage.setItem(LINK_FLAG, '1') : sessionStorage.removeItem(LINK_FLAG) } catch { /* ignore */ } }
  const [fromLink, setFromLinkState] = useState(() => { try { return sessionStorage.getItem(LINK_FLAG) === '1' && !cloud.isSignedIn() } catch { return false } })
  const setFromLink = (v) => { flag(v); setFromLinkState(v) }
  const linkDone = useRef(false)
  useEffect(() => {
    if (linkDone.current) return
    linkDone.current = true
    const link = cloud.readDeviceLink(param)
    if (!link) return
    try { history.replaceState(null, '', location.pathname + location.search + '#/cloud') } catch { /* ignore */ }
    if (cloud.isSignedIn()) return
    cloud.setConfig(link.url, link.anonKey)
    setUrl(link.url); setAnonKey(link.anonKey)
    cloud.setConsent(true); setConsent(true) // they chose cloud sync on the device that shared the link
    setFromLink(true)
  }, [param])

  const configured = cloud.isConfigured()
  const signedIn = cloud.isSignedIn()

  const toggleConsent = (v) => { setConsent(v); cloud.setConsent(v) }

  useEffect(() => { if (signedIn) cloud.listMembers().then(setMembers) }, [signedIn])
  useEffect(() => { if (signedIn) cloud.listAssistantKeys().then(setKeys) }, [signedIn])

  // File storage (documents, receipts, photos): does upload work, and how many
  // files on this device are still waiting to go up?
  const [store, setStore] = useState(null)      // 'ok' | 'no-bucket' | 'denied' | 'off' | 'error'
  const [pending, setPending] = useState(0)
  const [showStorageSql, setShowStorageSql] = useState(false)
  const checkStorage = async () => {
    setStore('checking')
    const st = await cloud.storageCheck()
    setStore(st)
    if (st === 'ok' || st === 'ok-table') { setBusy(true); try { await syncAttachments() } finally { setBusy(false) } }
    setPending(await pendingUploads())
  }
  useEffect(() => { if (signedIn) checkStorage() }, [signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const makeLink = async () => {
    setErr(''); setBusy(true); setNeedSetup(false)
    try {
      const { url } = await cloud.createAssistantKey('Claude')
      setNewLink(url)
      cloud.listAssistantKeys().then(setKeys)
    } catch (e) {
      if (e.message === 'MISSING_TABLE') { setNeedSetup(true); setShowClaudeSql(true) } else setErr(e.message)
    } finally { setBusy(false) }
  }
  const removeKey = async (hash) => {
    if (!window.confirm(t('claudeRemoveQ'))) return
    if (await cloud.deleteAssistantKey(hash)) { setKeys(keys.filter(k => k.key_hash !== hash)); toast.show(t('claudeRemoved')) }
  }
  const when = (iso) => iso ? new Date(iso).toLocaleString(lang === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : ''

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
      // A new device joining through the link: drop its sample data so only
      // the real, synced data shows.
      if (fromLink) removeSampleData()
      await cloudSync()
      cloud.listMembers().then(setMembers)
      toast.show(fromLink ? t('deviceLinkDone') : t('cloudConnected'))
      if (fromLink) { setFromLink(false); go('today') }
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
              <div className="muted small">
                {signedIn ? (cloud.currentUser()?.email || '') : t('cloudOffHint')}
              </div>
            </div>
          </div>
        </Card>

        {fromLink && !signedIn && (
          <Card className="stack" style={{ marginTop: 12, borderColor: 'var(--brand-500)' }}>
            <div style={{ fontWeight: 700 }}>{t('deviceLinkAlmost')}</div>
            <p className="hint" style={{ margin: 0 }}>{t('deviceLinkSignIn')}</p>
          </Card>
        )}

        {/* Project config */}
        {!signedIn && !fromLink && (
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
                  <pre style={{ maxHeight: 220, overflow: 'auto', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, fontSize: 13, lineHeight: 1.45 }}>{SETUP_SQL}</pre>
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

        {!signedIn && (
          <>
            <Section title={t('claudeConnect')} />
            <Card><p className="hint" style={{ margin: 0 }}>{t('claudeConnectHint')} {t('claudeNeedCloud')}</p></Card>
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

            <Section title={t('filesTitle')} />
            <Card className="stack">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`lead ${store === 'ok' || store === 'ok-table' ? 't-ok' : store === 'checking' || !store ? 't-info' : 't-warn'}`} style={{ width: 36, height: 36, borderRadius: 11, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Icon name={store === 'ok' || store === 'ok-table' ? 'check' : 'doc'} size={16} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{store === 'ok' || store === 'ok-table' ? t('filesOk') : store === 'checking' || !store ? t('pushChecking') : t('filesNotSet')}</div>
                  <div className="muted small">
                    {store === 'no-bucket' || store === 'denied' ? t('filesRunSql')
                      : store === 'error' ? t('filesError')
                      : pending > 0 ? `${pending} ${t('filesWaiting')}` : store === 'ok' || store === 'ok-table' ? t('filesAllUp') : ''}
                  </div>
                </div>
              </div>
              <div className="row2">
                <Button icon="refresh" onClick={checkStorage} disabled={busy || store === 'checking'}>{(store === 'ok' || store === 'ok-table') && pending > 0 ? t('filesUploadNow') : t('pushCheckAgain')}</Button>
                <Button icon="doc" onClick={() => setShowStorageSql(v => !v)}>{t('filesSql')}</Button>
              </div>
              {showStorageSql && (
                <>
                  <p className="hint" style={{ margin: 0 }}>{t('filesSqlHint')}</p>
                  <pre className="sql-box">{STORAGE_SQL}</pre>
                  <Button icon="copy" onClick={() => copy(STORAGE_SQL)}>{t('cloudCopySql')}</Button>
                </>
              )}
            </Card>

            <Section title={t('deviceLinkTitle')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('deviceLinkHint')}</p>
              <div className="row2">
                <Button variant="primary" icon="share" onClick={async () => {
                  const url = cloud.deviceLink()
                  try { if (navigator.share) { await navigator.share({ title: 'The Assistant', url }); return } } catch { return }
                  copy(url)
                }}>{t('share')}</Button>
                <Button icon="copy" onClick={() => copy(cloud.deviceLink())}>{t('copy')}</Button>
              </div>
            </Card>

            <Section title={t('claudeConnect')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('claudeConnectHint')}</p>
              {newLink ? (
                <>
                  <div className="label">{t('claudeLinkReady')}</div>
                  <div className="mono-box" aria-label={t('claudeLinkReady')}>{newLink}</div>
                  <Button block variant="primary" icon="copy" onClick={() => copy(newLink)}>{t('claudeCopyLink')}</Button>
                  <p className="hint" style={{ margin: '0 2px', color: 'var(--warn)' }}>{t('claudeLinkOnce')}</p>
                  <p className="hint" style={{ margin: '0 2px' }}>{t('claudeSteps')}</p>
                </>
              ) : (
                <Button block variant="primary" icon="sparkle" onClick={makeLink} disabled={busy}>{t('claudeMakeLink')}</Button>
              )}
              {needSetup && <p className="err" style={{ margin: '0 2px' }}>{t('claudeNeedSetup')}</p>}
              {keys.length > 0 && (
                <>
                  <div className="label" style={{ marginTop: 4 }}>{t('claudeLinks')}</div>
                  {keys.map(k => (
                    <div key={k.key_hash} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name="sparkle" size={16} style={{ color: 'var(--brand-600)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{k.label || 'Claude'} · …{k.key_hash.slice(0, 6)}</div>
                        <div className="muted small">{k.last_used_at ? `${t('claudeLastUsed')}: ${when(k.last_used_at)}` : t('claudeNeverUsed')}</div>
                      </div>
                      <Button icon="trash" onClick={() => removeKey(k.key_hash)}>{t('claudeRemove')}</Button>
                    </div>
                  ))}
                </>
              )}
              <button className="link-btn" style={{ alignSelf: 'flex-start' }} onClick={() => setShowClaudeSql(v => !v)}>{t('claudeSetupSql')}</button>
              {showClaudeSql && (
                <>
                  <pre className="sql-box">{CLAUDE_SQL}</pre>
                  <Button icon="copy" onClick={() => copy(CLAUDE_SQL)}>{t('cloudCopySql')}</Button>
                </>
              )}
            </Card>

            <Section title={t('cloudFamilyMembers')} />
            <Card className="stack">
              <p className="hint" style={{ margin: '0 2px' }}>{t('cloudInviteHint')}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 14, padding: '10px 12px', background: 'var(--surface-2)', border: '1px solid var(--line)', borderRadius: 10 }}>{cloud.householdId()}</div>
                <Button icon="copy" onClick={() => copy(cloud.householdId())}>{t('copy')}</Button>
              </div>
              {members.length > 0 && members.map((m, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
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
        <p className="center muted" style={{ marginTop: 18, fontSize: 14 }}>{t('cloudPrivacy')}</p>
      </div>
      {toast.node}
    </>
  )
}
