import Shell from './Shell.jsx'

// Shown when Supabase credentials aren't configured yet.
export default function SetupScreen() {
  const step = (n, text) => (
    <li style={{ fontSize: 13, color: '#ccc', lineHeight: 1.6, marginBottom: 10, listStyle: 'none', display: 'flex', gap: 10 }}>
      <span style={{
        flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
        background: 'var(--orange)', color: '#fff', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{n}</span>
      <span>{text}</span>
    </li>
  )
  return (
    <Shell>
      <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Connect your backend</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 }}>
        To share live data with your crew, set up a free Supabase project:
      </p>
      <ol style={{ paddingLeft: 0 }}>
        {step(1, <>Create a project at <span style={{ color: 'var(--gold)' }}>supabase.com</span>.</>)}
        {step(2, <>Open <b>SQL Editor</b>, paste the contents of <code style={{ color: 'var(--orange)' }}>supabase/schema.sql</code>, and Run.</>)}
        {step(3, <>In <b>Project Settings → API</b>, copy the <b>Project URL</b> and <b>anon key</b>.</>)}
        {step(4, <>Paste both into the <code style={{ color: 'var(--orange)' }}>.env</code> file and restart the dev server.</>)}
      </ol>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 8 }}>
        The first account you create becomes the crew admin automatically.
      </p>
    </Shell>
  )
}
