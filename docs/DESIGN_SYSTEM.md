# Lulu — Design System ("Effortless Authority")

An original visual identity — warm, calm, executive. Not a clone of any app.
All tokens live in `src/lulu/theme/tokens.css`; components in `components.css`.

## Brand idea
A private study at dusk: **warm parchment** surfaces, **ink** text, a single
**amber‑gold** accent for what matters. Confident, never loud.

## Colour tokens
| Token | Light | Dark | Use |
|---|---|---|---|
| `--brand-500` | `#C8963E` | `#D8AC55` | primary accent (gold) |
| `--bg` | `#F4F1EC` parchment | `#0E0F12` ink‑black | app background |
| `--surface` | `#FFFFFF` | `#191B20` | cards |
| `--ink` | `#1B1A17` | `#F3F1EC` | primary text |
| `--ink-3` | `#857F73` | `#7E7C75` | muted text |
| `--ok / warn / danger / info` | green / orange / red / blue | + `-tint` soft fills |

Status is always **colour + label** (never colour alone) for accessibility.

## Typography
System font stack (SF Pro on iOS, Noto Sans Arabic for Arabic). Scale:
`display 30 · title 22 · h 17 · body 15 · sm 13 · xs 11`. Headings use `-0.02em`
tracking. Money uses **tabular numerals** (`.tnum`).

## Shape, space, motion
- Radii: `sm 10 · md 16 · lg 22 · xl 28 · pill`. Cards use `lg`; sheets `26px`.
- Spacing scale 4→40 (`--s1`…`--s8`).
- Motion: one easing `cubic-bezier(.32,.72,0,1)`, ~0.28s. Sheets slide up; screens
  fade‑rise 6px. Press states scale to 0.97.
- Elevation: two soft shadows only (`--shadow-1`, `--shadow-2`).

## Core components (in `ui/`)
`Button` (primary/brand/ghost/danger), `Card`, `Section` header, `Chip`
(selectable/status‑tinted), `Field`+`Input`/`TextArea`/`Select`, `Segmented`,
`Sheet` (bottom‑sheet modal with grabber), `Empty` state, `Ring` (progress),
`Stat` tile, `Bars` (mini bar chart), `Fab`, `Icon` (one stroke set), `TopBar`,
`BottomNav`, `useToast`.

## Layout rules
- Mobile‑first, max content width **620px**, centered (works on phone & desktop).
- **Bottom nav** (5) + **FAB** for the primary create action per screen.
- Safe‑area insets respected top & bottom (notch / home indicator).
- One‑handed: primary actions sit in the bottom third.

## Dark mode
First‑class, not an afterthought — dedicated `[data-theme="dark"]` token set with
tuned shadows and accent. Follows system by default; user can force light/dark.

## RTL / Arabic
`dir` is set on `<html>`; all directional CSS uses **logical properties**
(`inset-inline-start`, `margin-inline`, `text-align:start`). The FAB, nav, chips and
sheets mirror automatically. Arabic strings live beside English in `i18n/strings.js`.

## Empty & loading states
Every list has a designed empty state (icon in a rounded tile + title + one line +
a primary action). Local reads are instant, so spinners are reserved for future
network calls (`.spinner`, `.loading-full` are provided).

## Iconography
A single, consistent 24×24 stroke set (`ui/Icon.jsx`) — elegant, 2px strokes,
rounded caps. One source of truth keeps the visual language coherent.
