// Best-effort, fully on-device receipt reading. Uses the browser's experimental
// TextDetector (Shape Detection API) when present — no network, no heavy libs.
// Always resolves; returns {} when detection is unavailable or finds nothing,
// so the caller simply falls back to manual entry with the photo attached.

function pickAmount(lines) {
  // Prefer a line mentioning total/إجمالي; otherwise the largest money-like number.
  const numbersIn = (s) => (s.match(/\d[\d,]*\.?\d{0,2}/g) || [])
    .map(x => parseFloat(x.replace(/,/g, ''))).filter(n => n > 0 && n < 1e7)
  const totalLine = lines.find(l => /total|grand|amount due|إجمالي|المجموع|الإجمالي/i.test(l))
  if (totalLine) { const n = numbersIn(totalLine); if (n.length) return Math.max(...n) }
  const all = lines.flatMap(numbersIn)
  return all.length ? Math.max(...all) : null
}

function pickDate(text) {
  // dd/mm/yyyy, yyyy-mm-dd, dd-mm-yy … return ISO yyyy-mm-dd when parseable.
  const m = text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) || text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/)
  if (!m) return null
  let y, mo, d
  if (m[1].length === 4) { y = +m[1]; mo = +m[2]; d = +m[3] }
  else { d = +m[1]; mo = +m[2]; y = +m[3]; if (y < 100) y += 2000 }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function ocrSupported() {
  return typeof window !== 'undefined' && 'TextDetector' in window
}

export async function scanReceipt(file) {
  try {
    if (!ocrSupported() || !file || !/^image\//.test(file.type)) return {}
    const bitmap = await createImageBitmap(file)
    // eslint-disable-next-line no-undef
    const detector = new TextDetector()
    const blocks = await detector.detect(bitmap)
    bitmap.close && bitmap.close()
    const lines = blocks.map(b => (b.rawValue || '').trim()).filter(Boolean)
    if (!lines.length) return {}
    const text = lines.join('\n')
    const amount = pickAmount(lines)
    const date = pickDate(text)
    // Merchant guess: first reasonably-long alphabetic line near the top.
    const merchant = (lines.find(l => /[A-Za-z؀-ۿ]{3,}/.test(l) && !/total|receipt|invoice|tax|vat/i.test(l)) || '').slice(0, 40)
    return { amount: amount || undefined, date: date || undefined, merchant: merchant || undefined }
  } catch {
    return {}
  }
}
