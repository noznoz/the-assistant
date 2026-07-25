// Offline heuristic "AI triage" — suggests how to classify a captured inbox line.
// Replaceable by a real AI call later; returns the same suggestion shape.
export function suggestTriage(text = '') {
  const s = text.toLowerCase()
  const amount = s.match(/(?:sar|ريال|﷼)?\s*(\d{2,7})\s*(?:sar|ريال)?/)
  const looksExpense = /\b(paid|bought|spent|صرف|دفعت|اشتريت|فاتورة|invoice|receipt)\b/.test(s) && amount

  let type = 'task'
  if (/\b(call|contact|follow up|اتصل|تابع|متابعة)\b/.test(s)) type = 'follow_up'
  else if (/\b(approve|approval|وافق|موافقة|اعتماد)\b/.test(s)) type = 'approval'
  else if (/\b(idea|فكرة|maybe|ربما)\b/.test(s)) type = 'idea'
  else if (/\b(buy|pick up|errand|اشتري|أحضر)\b/.test(s)) type = 'errand'

  let priority = 'medium'
  if (/\b(urgent|asap|critical|عاجل|مهم جدا|فوري)\b/.test(s)) priority = 'critical'
  else if (/\b(important|high|مهم|أولوية)\b/.test(s)) priority = 'high'

  const classification = /\b(work|office|boss|client|عمل|مكتب|عميل)\b/.test(s) ? 'work' : 'personal'

  let dueDate = ''
  const today = new Date()
  if (/\b(today|اليوم)\b/.test(s)) dueDate = today.toISOString().slice(0, 10)
  else if (/\b(tomorrow|غدا|بكرة)\b/.test(s)) { const d = new Date(); d.setDate(d.getDate() + 1); dueDate = d.toISOString().slice(0, 10) }

  if (type === 'idea') return { kind: 'note', title: text, type, priority, classification }

  const title = text.replace(/\s+/g, ' ').trim().slice(0, 120)
  return { kind: 'task', title, type, priority, classification, dueDate }
}
