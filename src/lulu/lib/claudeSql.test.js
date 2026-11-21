// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { CLAUDE_SQL } from './claudeSql.js'

// The paste-ready file and the copy shown in the app must never drift apart.
describe('Claude connector SQL', () => {
  it('supabase/claude-connector.sql matches the in-app copy', () => {
    const file = readFileSync(new URL('../../../supabase/claude-connector.sql', import.meta.url), 'utf8')
    expect(file.trim()).toBe(CLAUDE_SQL.trim())
  })
  it('the same statements are in schema.sql', () => {
    const schema = readFileSync(new URL('../../../supabase/schema.sql', import.meta.url), 'utf8')
    expect(schema).toContain('create table if not exists public.assistant_keys')
    expect(schema).toContain('return null;  -- skip this write; the stored copy is newer')
  })
})
