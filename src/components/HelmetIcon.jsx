// Clean full-face helmet icon. The visor is a transparent cut-out (evenodd),
// so it reads on any background. Uses currentColor.
export default function HelmetIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} fillRule="evenodd" clipRule="evenodd" style={{ display: 'block' }}>
      <path d="M12 2.5c-5.2 0-8.5 3.6-8.5 8.5v4a1.6 1.6 0 0 0 1.6 1.6h2.1l.9 2.6a1 1 0 0 0 .95.7h7.9a1.6 1.6 0 0 0 1.6-1.6v-7.6c0-4.9-3.3-8.5-8.5-8.5zM8.6 10.2H18a1.6 1.6 0 0 1 0 3.2H8.6a1.6 1.6 0 0 1 0-3.2z" />
    </svg>
  )
}
