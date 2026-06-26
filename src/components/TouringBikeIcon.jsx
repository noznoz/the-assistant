// A touring / bagger motorcycle icon (big windshield + saddlebag),
// since Unicode only has a sport-bike emoji. Uses currentColor.
export default function TouringBikeIcon({ size = 24, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 54" fill="none" style={{ display: 'block' }}>
      <g fill={color}>
        {/* Windshield */}
        <path d="M34 30 C26 22 25 9 33 3 L43 3 C39 12 41 22 45 30 Z" />
        {/* Low body with seat dip */}
        <path d="M20 36 L26 29 L46 29 C50 21 60 21 64 29 L86 29 C90 25 98 26 102 29 L106 36 Z" />
        {/* Hard saddlebag */}
        <rect x="86" y="24" width="27" height="13" rx="3.5" />
        {/* Headlight */}
        <circle cx="30" cy="33" r="5" />
      </g>
      {/* Wheels */}
      <circle cx="30" cy="42" r="11" stroke={color} strokeWidth="5.5" />
      <circle cx="96" cy="42" r="11" stroke={color} strokeWidth="5.5" />
      <circle cx="30" cy="42" r="2.3" fill={color} />
      <circle cx="96" cy="42" r="2.3" fill={color} />
    </svg>
  )
}
