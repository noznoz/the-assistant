// Round rider avatar: real profile picture when the rider has one,
// emoji fallback otherwise. Used everywhere a rider posts.
export default function Avatar({ rider, emoji = '🤘', size = 36, border = 'var(--orange)' }) {
  const base = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${border}`, background: '#2a2a2a',
  }
  if (rider?.photo) {
    return (
      <img src={rider.photo} alt={rider.name || ''} loading="lazy" decoding="async"
        style={{ ...base, objectFit: 'cover', display: 'block' }} />
    )
  }
  return (
    <div style={{
      ...base, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.5),
    }}>
      {rider?.avatar || emoji}
    </div>
  )
}
