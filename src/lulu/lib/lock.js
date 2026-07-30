// App-lock helpers: passcode hashing (SHA-256) + optional device biometric
// (Face ID / Touch ID) via WebAuthn. Biometric is always best-effort with the
// passcode as the guaranteed fallback, so a failing sensor never locks you out.

export async function hashPin(pin) {
  const data = new TextEncoder().encode('the-assistant:' + pin)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

export async function verifyPin(pin, hash) {
  if (!hash) return false
  try { return (await hashPin(pin)) === hash } catch { return false }
}

export function biometricSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

// Enroll the platform authenticator; returns a credential id (base64) to store.
export async function enrollBiometric(name = 'The Assistant') {
  if (!biometricSupported()) throw new Error('unsupported')
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'The Assistant' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name, displayName: name },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
      attestation: 'none',
    },
  })
  return b64(cred.rawId)
}

// Prompt Face ID / Touch ID for the stored credential. Throws if it fails.
export async function verifyBiometric(credIdB64) {
  if (!biometricSupported() || !credIdB64) throw new Error('unavailable')
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: fromB64(credIdB64), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60000,
    },
  })
  return true
}
