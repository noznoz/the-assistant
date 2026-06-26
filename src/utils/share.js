export function shareToWhatsApp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

export async function shareWithImage({ text, imageFile }) {
  if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
    try {
      await navigator.share({ files: [imageFile], text })
      return
    } catch (e) {
      if (e.name === 'AbortError') return
    }
  }
  shareToWhatsApp(text)
}
