// Native phone contact picker via the Contact Picker API. Supported on Chrome
// for Android; not available on iOS Safari (Apple blocks web access to
// contacts), so callers must feature-detect and offer manual entry there.

export function contactPickerSupported() {
  return typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window
}

// Returns an array of { name, mobile, email } (empty if cancelled/unsupported).
export async function pickContacts({ multiple = true } = {}) {
  if (!contactPickerSupported()) return []
  try {
    const props = ['name', 'tel', 'email']
    const chosen = await navigator.contacts.select(props, { multiple })
    return (chosen || []).map(c => ({
      name: (c.name && c.name[0]) || '',
      mobile: (c.tel && c.tel[0]) || '',
      email: (c.email && c.email[0]) || '',
    })).filter(c => c.name || c.mobile)
  } catch {
    return []
  }
}
