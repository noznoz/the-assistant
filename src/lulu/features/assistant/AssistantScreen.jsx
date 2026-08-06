import React, { useState, useRef, useEffect } from 'react'
import Icon from '../../ui/Icon.jsx'
import { DetailHeader, Empty, Button } from '../../ui/primitives.jsx'
import { useT } from '../../i18n/I18nProvider.jsx'
import { useStore, useSettings, useCollection } from '../../store/StoreProvider.jsx'
import { requestClaude } from '../../lib/ai.js'
import { buildAssistantContext } from '../../lib/assistantContext.js'
import { todayISO, money } from '../../lib/format.js'

// ---- Tools the model can call to DO things (applied only after the user
// confirms via the card below). Kept intentionally small and forgiving. ----
const TOOLS = [
  {
    name: 'add_task',
    description: "Add a to-do task to the user's task list.",
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short task title' },
        dueDate: { type: 'string', description: 'Due date as ISO YYYY-MM-DD (optional)' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        classification: { type: 'string', enum: ['work', 'personal'] },
        notes: { type: 'string', description: 'Extra detail (optional)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'log_expense',
    description: 'Log an expense. For petrol/fuel, set category to "fuel" and include the related vehicle, litres and odometer when known.',
    input_schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount paid' },
        currency: { type: 'string', description: 'ISO currency code, defaults to the app currency' },
        category: { type: 'string', description: 'e.g. fuel, dining, groceries, shopping, vehicle_maint' },
        merchant: { type: 'string' },
        date: { type: 'string', description: 'ISO YYYY-MM-DD, defaults to today' },
        vehicle: { type: 'string', description: 'Name/nickname of the related vehicle (fuel & maintenance)' },
        liters: { type: 'number', description: 'Fuel litres (fuel only)' },
        odometer: { type: 'number', description: 'Odometer reading in km (fuel only)' },
      },
      required: ['amount'],
    },
  },
  {
    name: 'add_appointment',
    description: 'Add an appointment / calendar event.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        date: { type: 'string', description: 'ISO YYYY-MM-DD' },
        time: { type: 'string', description: 'HH:MM 24-hour (optional)' },
        location: { type: 'string' },
        type: { type: 'string', description: 'e.g. doctor, dentist, checkup, school, meeting' },
        person: { type: 'string', description: 'Name of the person it is for (optional)' },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'add_note',
    description: 'Save a quick note.',
    input_schema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  },
  {
    name: 'add_person',
    description: "Add a contact to the user's People list (family, colleague, service contact).",
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name' },
        relationship: { type: 'string', description: 'e.g. family, friend, colleague, doctor, mechanic' },
        phone: { type: 'string' },
        email: { type: 'string' },
        birthday: { type: 'string', description: 'ISO YYYY-MM-DD (optional)' },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'complete_task',
    description: 'Mark an existing open task as completed. Match it by title against the OPEN TASKS in the snapshot.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'The task title (or a close match) to complete' },
      },
      required: ['title'],
    },
  },
]

function resolveVehicle(vehicles, name) {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  const list = vehicles || []
  return list.find(v => (v.nickname || '').toLowerCase() === n || (v.name || '').toLowerCase() === n)
    || list.find(v => [v.nickname, v.name, v.brand, v.model].filter(Boolean)
      .some(s => { const x = String(s).toLowerCase(); return x.includes(n) || n.includes(x) }))
    || null
}
function resolvePerson(people, name) {
  if (!name) return null
  const n = String(name).trim().toLowerCase()
  const list = people || []
  return list.find(p => (p.name || '').toLowerCase() === n)
    || list.find(p => { const x = (p.name || '').toLowerCase(); return x && (x.includes(n) || n.includes(x)) })
    || null
}
function resolveOpenTask(tasks, title) {
  if (!title) return null
  const n = String(title).trim().toLowerCase()
  const open = (tasks || []).filter(t => t && !t.deletedAt && t.status !== 'completed' && t.status !== 'cancelled')
  return open.find(t => (t.title || '').toLowerCase() === n)
    || open.find(t => { const x = (t.title || '').toLowerCase(); return x && (x.includes(n) || n.includes(x)) })
    || null
}

// Turn a tool_use block into { collection, fields, label, result }. Pure: used
// both to render the confirmation card and to apply the action on confirm.
function computeAction(tu, { data, settings, t, lang }) {
  const input = tu.input || {}
  const cur = input.currency || settings.currency || 'SAR'
  if (tu.name === 'add_task') {
    const fields = {
      title: input.title || t('addTask'),
      type: 'task',
      classification: input.classification === 'work' ? 'work' : 'personal',
      priority: ['low', 'medium', 'high', 'critical'].includes(input.priority) ? input.priority : 'medium',
      status: input.dueDate ? 'planned' : 'new',
      dueDate: input.dueDate || '',
      description: input.notes || '',
    }
    return {
      collection: 'tasks', fields,
      label: `${t('actAddTask')} · ${fields.title}${fields.dueDate ? ` · ${fields.dueDate}` : ''}`,
      result: `Added task "${fields.title}"${fields.dueDate ? ` due ${fields.dueDate}` : ''}.`,
    }
  }
  if (tu.name === 'log_expense') {
    const veh = resolveVehicle(data.vehicles, input.vehicle)
    const isFuel = String(input.category || '').toLowerCase() === 'fuel' || input.liters != null || input.odometer != null
    const fields = {
      amount: Number(input.amount) || 0,
      currency: cur,
      category: isFuel ? 'fuel' : (input.category || 'other'),
      merchant: input.merchant || '',
      date: input.date || todayISO(),
      classification: 'personal',
    }
    if (veh) fields.relatedVehicle = veh.id
    if (input.liters != null) fields.liters = Number(input.liters)
    if (input.odometer != null) fields.odometer = Number(input.odometer)
    const vehName = veh ? (veh.nickname || veh.name) : ''
    const amt = money(fields.amount, cur, lang)
    return {
      collection: 'expenses', fields,
      label: `${t('actLogExpense')} · ${amt} ${fields.category}${vehName ? ` · ${vehName}` : ''}`,
      result: `Logged ${amt} ${fields.category}${vehName ? ` on ${vehName}` : ''}${fields.liters ? `, ${fields.liters} L` : ''}.`,
    }
  }
  if (tu.name === 'add_appointment') {
    const person = resolvePerson(data.people, input.person)
    const fields = {
      title: input.title || t('addAppointment'),
      type: input.type || '',
      date: input.date || todayISO(),
      time: input.time || '',
      location: input.location || '',
    }
    if (person) fields.personId = person.id
    return {
      collection: 'appointments', fields,
      label: `${t('actAddAppointment')} · ${fields.title} · ${fields.date}${fields.time ? ` ${fields.time}` : ''}`,
      result: `Added appointment "${fields.title}" on ${fields.date}${fields.time ? ` at ${fields.time}` : ''}.`,
    }
  }
  if (tu.name === 'add_note') {
    const fields = { text: input.text || '' }
    return {
      collection: 'notes', fields,
      label: `${t('actAddNote')} · ${(fields.text || '').slice(0, 60)}`,
      result: 'Saved note.',
    }
  }
  if (tu.name === 'add_person') {
    const fields = {
      name: input.name || t('addPerson') || 'New person',
      relationship: input.relationship || '',
      phone: input.phone || '',
      email: input.email || '',
      birthday: input.birthday || '',
      notes: input.notes || '',
    }
    return {
      collection: 'people', fields,
      label: `${t('actAddPerson')} · ${fields.name}${fields.relationship ? ` · ${fields.relationship}` : ''}`,
      result: `Added ${fields.name} to People.`,
    }
  }
  if (tu.name === 'complete_task') {
    const task = resolveOpenTask(data.tasks, input.title)
    if (!task) {
      // No confirmation card for a miss — the model gets told and can reply.
      return { op: 'noop', label: '', result: `No open task matching "${input.title || ''}" was found.` }
    }
    return {
      op: 'patch', collection: 'tasks', id: task.id,
      patch: { status: 'completed', completedAt: todayISO() },
      label: `${t('actCompleteTask')} · ${task.title}`,
      result: `Marked "${task.title}" complete.`,
    }
  }
  return null
}

// The persona + guardrails. Data is injected fresh on every send so the
// assistant always reasons over the current snapshot.
function systemPrompt(data, settings, lang) {
  const ctx = buildAssistantContext(data, settings)
  const name = (settings.profile && settings.profile.fullName) || settings.name || 'the user'
  return [
    `You are "The Assistant", a concise, proactive personal assistant inside ${name}'s private, offline-first personal-OS app.`,
    `You can ANSWER questions grounded in the data snapshot below, and you can TAKE ACTIONS with the provided tools: add a task, log an expense (including fuel with the related vehicle, litres and odometer), add an appointment, save a note, add a person to the contacts, and mark an existing open task complete.`,
    `When the user clearly wants something created, call the matching tool. Infer sensible fields from the message and the snapshot. Use ISO YYYY-MM-DD for dates and resolve relative dates ("tomorrow", "next Friday") against Today in the snapshot. For a vehicle, pass its name or nickname exactly as it appears in the snapshot. For petrol/fuel use log_expense with category "fuel".`,
    `The app shows the user a confirmation card before anything is created, so don't ask "shall I?" — just call the tool with your best-guess fields. Only if a required detail is genuinely missing (e.g. no amount for an expense) ask one short question instead of calling the tool.`,
    `After a tool runs you receive its result; reply with a single short line beginning with "✓" that states exactly what was created (e.g. "✓ Logged SAR 250 fuel on Iron Raven").`,
    `Be brief and specific. Prefer bullet points for lists. Format money with the currency shown. Never invent data — if something isn't in the snapshot, say you don't have it and suggest where in the app to add it.`,
    lang === 'ar' ? 'Reply in Arabic.' : 'Reply in English.',
    `\n--- DATA SNAPSHOT ---\n${ctx}`,
  ].join('\n')
}

// Extract displayable text from a turn's content (string or content blocks).
function turnText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim()
  return ''
}

const speechSupported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)

export default function AssistantScreen({ go }) {
  const { t, lang } = useT()
  const { data } = useStore()
  const { settings } = useSettings()
  // One handle per collection the assistant can write to (per the spec).
  const collections = {
    tasks: useCollection('tasks'),
    expenses: useCollection('expenses'),
    appointments: useCollection('appointments'),
    notes: useCollection('notes'),
    people: useCollection('people'),
  }
  const [messages, setMessages] = useState([]) // { role, content: string | blocks[] }
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // { toolUses, history }
  const [listening, setListening] = useState(false)
  const scrollRef = useRef(null)
  const taRef = useRef(null)
  const recognitionRef = useRef(null)

  const hasKey = !!settings.anthropicKey

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy, pending])

  // Stop any live speech capture when leaving the screen.
  useEffect(() => () => { try { recognitionRef.current && recognitionRef.current.stop() } catch { /* ignore */ } }, [])

  const errMsg = (e) => e.status === 401 ? t('aiKeyBad')
    : e.status === 429 ? t('aiRateLimited')
    : (e.message || t('aiError'))

  const apiMessages = (turns) => turns.map(m => ({ role: m.role, content: m.content }))

  // One assistant turn: request (with tools), append the reply, and if the model
  // asked to use tools, park them for the confirmation card.
  const runConversation = async (history) => {
    setBusy(true); setError('')
    try {
      const res = await requestClaude({
        apiKey: settings.anthropicKey,
        model: settings.aiModel,
        system: systemPrompt(data, settings, lang),
        tools: TOOLS,
        messages: apiMessages(history),
        maxTokens: 1024,
      })
      if (res.stopReason === 'refusal') {
        setMessages([...history, { role: 'assistant', content: t('aiRefusal') }])
        return
      }
      const withAssistant = [...history, { role: 'assistant', content: res.content }]
      setMessages(withAssistant)
      if (res.stopReason === 'tool_use' && res.toolUses.length) {
        setPending({ toolUses: res.toolUses, history: withAssistant })
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const send = async () => {
    const text = input.trim()
    if (!text || busy || pending) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    if (taRef.current) taRef.current.style.height = 'auto'
    await runConversation(next)
  }

  // Apply the parked tool calls, then feed their results back so the model can
  // give its "✓ …" confirmation.
  const confirmActions = async () => {
    if (!pending) return
    const { toolUses, history } = pending
    setPending(null)
    const toolResults = toolUses.map(tu => {
      const action = computeAction(tu, { data, settings, t, lang })
      if (!action) return { type: 'tool_result', tool_use_id: tu.id, content: "That action isn't supported yet." }
      if (action.op === 'patch') collections[action.collection].patch(action.id, action.patch)
      else if (action.op !== 'noop') collections[action.collection].add(action.fields)
      return { type: 'tool_result', tool_use_id: tu.id, content: action.result }
    })
    const next = [...history, { role: 'user', content: toolResults }]
    setMessages(next)
    await runConversation(next)
  }

  const cancelActions = async () => {
    if (!pending) return
    const { toolUses, history } = pending
    setPending(null)
    const toolResults = toolUses.map(tu => ({ type: 'tool_result', tool_use_id: tu.id, content: 'User declined. Nothing was created.' }))
    const next = [...history, { role: 'user', content: toolResults }]
    setMessages(next)
    await runConversation(next)
  }

  const toggleMic = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return
    if (listening) { try { recognitionRef.current && recognitionRef.current.stop() } catch { /* ignore */ } return }
    const rec = new SR()
    rec.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    rec.interimResults = true
    rec.continuous = false
    const base = input ? input + ' ' : ''
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      setInput((base + text).replace(/\s+/g, ' ').trimStart())
      if (taRef.current) { taRef.current.style.height = 'auto'; taRef.current.style.height = Math.min(120, taRef.current.scrollHeight) + 'px' }
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }
  const grow = (e) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'
  }

  const suggestions = [t('aiSug1'), t('aiSug2'), t('aiSug3')]
  // Only actions that actually change something get a confirmation card; a
  // "noop" (e.g. complete_task that matched nothing) is applied silently so the
  // model receives the result and can explain, with no empty card to confirm.
  const pendingActions = pending ? pending.toolUses.map(tu => computeAction(tu, { data, settings, t, lang })).filter(a => a && a.op !== 'noop') : []

  // If the model's tool calls produced nothing to confirm (all noops), feed the
  // results back automatically rather than parking an empty card.
  useEffect(() => {
    if (pending && !busy && pendingActions.length === 0) confirmActions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, busy])

  return (
    <>
      <DetailHeader title={t('assistant')} onBack={() => go('more')}
        right={messages.length > 0 && (
          <button className="iconbtn" aria-label={t('clearChat')} onClick={() => { setMessages([]); setError(''); setPending(null) }}>
            <Icon name="refresh" size={18} />
          </button>
        )} />

      {!hasKey ? (
        <div className="screen">
          <Empty icon="sparkle" title={t('assistantTitle')} text={t('addKeyToStart')}
            action={<Button variant="primary" icon="cog" onClick={() => go('settings')}>{t('addKeyBtn')}</Button>} />
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="screen" style={{ paddingBottom: 150 }}>
            {messages.length === 0 && (
              <div style={{ marginTop: 8 }}>
                <div style={{ display: 'grid', placeItems: 'center', padding: '18px 0 10px' }}>
                  <span className="lead t-brand" style={{ width: 54, height: 54, borderRadius: 16, display: 'grid', placeItems: 'center' }}>
                    <Icon name="sparkle" size={26} />
                  </span>
                </div>
                <h2 className="center" style={{ margin: '4px 0 2px', fontSize: 19 }}>{t('assistantTitle')}</h2>
                <p className="center muted" style={{ margin: '0 0 6px', fontSize: 13 }}>{t('assistantHint')}</p>
                <p className="center muted" style={{ margin: '0 0 16px', fontSize: 12.5 }}>{t('aiActionsHint')}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {suggestions.map((s, i) => (
                    <button key={i} className="card tight" style={{ textAlign: 'start', padding: '12px 14px', fontSize: 14, fontWeight: 550, cursor: 'pointer' }}
                      onClick={() => { setInput(s); setTimeout(() => taRef.current?.focus(), 0) }}>
                      <Icon name="sparkle" size={13} style={{ color: 'var(--brand-600)', marginInlineEnd: 8 }} />{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const text = turnText(m.content)
              if (!text) return null
              return (
                <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', margin: '8px 0' }}>
                  <div style={{
                    maxWidth: '86%', padding: '10px 13px', borderRadius: 16, fontSize: 14.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.role === 'user' ? 'var(--brand-600)' : 'var(--surface)',
                    color: m.role === 'user' ? '#fff' : 'var(--ink)',
                    border: m.role === 'user' ? 0 : '1px solid var(--line)',
                    borderBottomRightRadius: m.role === 'user' ? 5 : 16,
                    borderBottomLeftRadius: m.role === 'user' ? 16 : 5,
                  }}>{text}</div>
                </div>
              )
            })}

            {pending && pendingActions.length > 0 && !busy && (
              <div className="card" style={{ margin: '10px 0', padding: '12px 14px', border: '1px solid var(--brand-600)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--brand-600)', marginBottom: 8 }}>
                  <Icon name="sparkle" size={13} style={{ marginInlineEnd: 6 }} />{t('aiConfirmTitle')}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {pendingActions.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 14, fontWeight: 550 }}>
                      <Icon name="check" size={15} style={{ color: 'var(--brand-600)', marginTop: 2, flexShrink: 0 }} />
                      <span>{a.label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" icon="check" onClick={confirmActions}>{t('aiConfirmDo')}</Button>
                  <Button variant="ghost" onClick={cancelActions}>{t('cancel')}</Button>
                </div>
              </div>
            )}

            {busy && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', margin: '8px 0' }}>
                <div className="card tight" style={{ padding: '10px 14px', color: 'var(--ink-3)', fontSize: 14 }}>
                  <span className="dots">{t('thinking')}…</span>
                </div>
              </div>
            )}
            {error && <p className="err" style={{ margin: '8px 2px' }}>{error}</p>}
          </div>

          <div style={{
            position: 'fixed', left: 0, right: 0, bottom: 'calc(60px + env(safe-area-inset-bottom))',
            maxWidth: 620, margin: '0 auto', zIndex: 25,
            background: 'var(--bg)', borderTop: '1px solid var(--line)',
            padding: '10px 14px', display: 'flex', alignItems: 'flex-end', gap: 8,
          }}>
            {speechSupported && (
              <button className="fab" onClick={toggleMic} aria-label={listening ? t('micListening') : t('micStart')}
                style={{ position: 'static', width: 44, height: 44, flexShrink: 0,
                  background: listening ? 'var(--danger, #e5484d)' : 'var(--surface)',
                  color: listening ? '#fff' : 'var(--ink)', border: '1px solid var(--line)',
                  animation: listening ? 'dotpulse 1.2s ease-in-out infinite' : 'none' }}>
                <Icon name="mic" size={20} />
              </button>
            )}
            <textarea ref={taRef} className="textarea" rows={1} value={input} onChange={grow} onKeyDown={onKeyDown}
              placeholder={listening ? t('micListening') : t('askAnything')} style={{ flex: 1, resize: 'none', minHeight: 42, maxHeight: 120, padding: '10px 12px' }} />
            <button className="fab" style={{ position: 'static', width: 44, height: 44, flexShrink: 0, opacity: input.trim() && !busy && !pending ? 1 : 0.5 }}
              aria-label={t('send')} onClick={send} disabled={!input.trim() || busy || !!pending}>
              <Icon name="chevron" size={22} style={{ transform: 'rotate(-90deg)' }} />
            </button>
          </div>
        </>
      )}
    </>
  )
}
