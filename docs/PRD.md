# Lulu — Product Requirements Document

## 1. Product vision
Lulu is a **personal operating system for an executive**: one calm, premium place to
run the day — work tasks and requests, delegated follow‑ups, personal errands, a
digital garage for vehicles, expenses, documents, trips, reminders and reports.
It replaces a scatter of notes apps, spreadsheets, reminder apps and photo folders
with a single, beautiful, bilingual (English/Arabic) tool that works offline and
shares cleanly to WhatsApp.

**Design north star:** *"Effortless authority."* Every screen should feel like a
well‑run private office — quiet, confident, one‑handed, never cluttered.

## 2. Target user & personas
- **Primary — "The Executive" (Nizar):** busy professional in Riyadh. Manages work
  requests, delegates to a team, owns several vehicles (cars, a motorcycle, a boat),
  travels, and wants tight control of expenses. Values speed, privacy, and polish.
  Not a power‑user of complex apps; wants clarity over configurability.
- **Secondary — "The Assistant" (future):** an EA who, with permission, helps triage
  the inbox, schedule, and follow up (Phase 4 role‑based access).
- **Tertiary — "The Family" (future):** shared trips, shared vehicles, shared budgets.

## 3. Goals & success signals
- Capture anything in **under 3 seconds** (Inbox / quick actions).
- See "what needs me today" in **one glance** (Today dashboard).
- Never miss a **renewal or follow‑up** (reminders + notification feed).
- Share a professional update to WhatsApp in **two taps**.
- Feels **premium** enough to use daily and show to a peer.

## 4. Scope by phase (summary — full plan in ROADMAP.md)
- **Phase 1 (this build):** Auth‑ready shell, Today, Tasks & Requests, Inbox, Garage,
  Expenses, People, Documents, Trips, Reports, Calendar, Notifications, Settings,
  WhatsApp sharing, offline local storage, EN/AR, dark/light. *(Auth + cloud sync
  are architected and stubbed; they turn on in Phase 2.)*
- **Phase 2:** Supabase auth + sync, receipt scan, budgets, calendar integration,
  document files, richer reminders.
- **Phase 3:** Lulu AI Assistant, voice capture, advanced analytics, PDF/Excel export,
  Siri Shortcuts.
- **Phase 4:** Family & assistant roles, web dashboard, Android polish, CarPlay‑style
  surfaces, WhatsApp Business.

## 5. Feature map (11 modules)
1. **Today** — greeting, date, AI morning brief, progress ring, today's tasks,
   overdue, waiting‑for‑me, delegated, renewals, today's & monthly spend, quick
   notes, 8 quick actions, share agenda.
2. **Tasks & Requests** — full task model, 8 types, 10 statuses, 4 priorities,
   views (all/today/upcoming/overdue/waiting‑me/delegated/completed), search,
   complete, duplicate, delete, WhatsApp share, AI follow‑up draft.
3. **Inbox** — universal quick capture + heuristic AI triage into task/note.
4. **People & Delegation** — contacts, relationship, open items per person, one‑tap
   WhatsApp.
5. **Garage** — cars/motorcycles/boats as image cards; profile with specs,
   biography, insurance, maintenance history, per‑vehicle expenses & total cost;
   share as a clean summary.
6. **Expenses** — full expense model, 24 categories, 8 payment methods, ranges
   (today/week/month/year), category chart, budget bar, share summary.
7. **Calendar** — agenda timeline of tasks + renewals (full sync in Phase 2).
8. **Documents** — categorised vault with expiry reminders (files in Phase 2).
9. **Trips** — trips with vehicle, dates, destination; WhatsApp itinerary.
10. **Reports** — daily/weekly/monthly review with share.
11. **Notifications** — live feed from overdue/today/waiting/renewals/doc expiry.
Plus **Settings**, **Global Search**, and the **Lulu Assistant** (Phase 3).

## 6. Key user journeys
1. **Morning:** open Today → read AI brief → tap *Share agenda* → sends to WhatsApp.
2. **Capture a request:** quick action *Add request* → title + assignee → saved as
   "waiting for someone" → appears under Delegated and on that Person.
3. **Follow up:** open the waiting task → *Draft follow‑up message* → polished text
   copied → paste into WhatsApp.
4. **Log a cost:** *Add expense* → amount, category, link to *Iron Raven* → shows in
   the vehicle's total cost and monthly spend.
5. **Stay compliant:** Garage card shows insurance expiring in 12 days → Notifications
   surfaces it → renew and update the policy date.

## 7. Non‑functional requirements
- **Offline‑first**, instant, no spinner on local reads.
- **Bilingual** EN/AR with full RTL.
- **Private by default** (local storage; explicit consent before any cloud/AI).
- **Accessible** text sizes, high contrast, large tap targets, one‑handed reach.
- **Premium** motion and empty states; no dead ends.

## 8. Out of scope (for now)
Unofficial WhatsApp automation, real‑time multi‑user editing, bank/email auto‑import,
and native‑only OS features — all deferred and architected for later.
