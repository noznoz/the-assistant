import React from 'react'

// A lightweight SVG line chart for net-worth history, with an area fill,
// end-point marker and optional milestone dots. No external chart library.
export default function NetWorthChart({ points = [], milestones = [], format = (v) => v, height = 150 }) {
  if (points.length < 2) return null
  const W = 320, H = height, padX = 6, padTop = 14, padBot = 22
  const xs = points.map((_, i) => padX + i * (W - padX * 2) / (points.length - 1))
  const values = points.map(p => p.value)
  const min = Math.min(...values), max = Math.max(...values)
  const span = max - min || 1
  const y = (v) => padTop + (1 - (v - min) / span) * (H - padTop - padBot)
  const pts = points.map((p, i) => [xs[i], y(p.value)])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = `${line} L${xs[xs.length - 1].toFixed(1)},${H - padBot} L${xs[0].toFixed(1)},${H - padBot} Z`
  const last = pts[pts.length - 1]

  // Show a subset of x labels to avoid crowding.
  const step = Math.ceil(points.length / 6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="nwFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-500, var(--brand-400))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brand-500, var(--brand-400))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#nwFill)" />
      <path d={line} fill="none" stroke="var(--brand-500, var(--brand-400))" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      {milestones.map((m, i) => (
        <g key={i}>
          <circle cx={xs[m.index]} cy={y(points[m.index].value)} r="4.5" fill="var(--surface)" stroke="var(--ok)" strokeWidth="2.5" />
          <text x={xs[m.index]} y={y(points[m.index].value) - 9} textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--ok)">{m.label}</text>
        </g>
      ))}
      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--brand-600)" stroke="var(--surface)" strokeWidth="2" />
      {points.map((p, i) => (i % step === 0 || i === points.length - 1) && (
        <text key={i} x={xs[i]} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{p.label}</text>
      ))}
    </svg>
  )
}
