import { describe, test, expect } from 'vitest'
import { splitBase64, joinBase64, CHUNK, blobToBase64, base64ToBlob } from './fileChunks.js'

describe('files through the records table', () => {
  test('a small file is one piece', () => {
    const rows = splitBase64('f1', 'image/png', 'QUJD')
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('file:f1:0')
    expect(joinBase64(rows)).toEqual({ type: 'image/png', b64: 'QUJD' })
  })
  test('a large file splits and joins back exactly, in any order', () => {
    const b64 = 'x'.repeat(CHUNK * 2 + 123)
    const rows = splitBase64('f2', 'application/pdf', b64)
    expect(rows).toHaveLength(3)
    expect(joinBase64([rows[2], rows[0], rows[1]]).b64).toBe(b64)
  })
  test('missing pieces → not ready', () => {
    const rows = splitBase64('f3', 'application/pdf', 'y'.repeat(CHUNK + 1))
    expect(joinBase64([rows[0]])).toBe(null)
    expect(joinBase64([])).toBe(null)
  })
  test('bytes survive the round trip', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])
    const b64 = await blobToBase64(new Blob([bytes], { type: 'application/octet-stream' }))
    const blob = base64ToBlob(b64, 'application/octet-stream')
    const buf = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsArrayBuffer(blob) })
    const back = new Uint8Array(buf)
    expect([...back]).toEqual([...bytes])
  })
})
