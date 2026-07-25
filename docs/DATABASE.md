# Lulu — Data Model & Database Schema

Phase 1 stores each collection as a JSON array in `localStorage`. Every record
carries `id`, `createdAt`, `updatedAt`, `deletedAt` (soft delete). The **same shape**
maps 1:1 to the Supabase Postgres schema below (Phase 2), so migration is a copy.

## Entities & relationships (ER overview)
```
users 1─┐
        ├─< tasks >── people (requestedBy / assignedTo)
        ├─< tasks >── projects
        ├─< vehicles >──< services
        │             └──< accessories
        ├─< expenses >── vehicles / people / trips / categories / payment_methods
        ├─< documents >── vehicles / tasks / expenses / trips
        ├─< trips >──< trip_days >──< reservations
        ├─< inbox_items >
        ├─< notes >
        ├─< notifications >
        └─< audit_logs >
```

## Collections (Phase 1 fields)
- **tasks**: title, description, type, classification(work/personal), priority,
  status, startDate, dueDate, dueTime, reminder, project, department, requestedBy,
  assignedTo, people[], tags, completionPct, followUp, recurrence, relatedVehicle,
  relatedTrip, relatedExpense, completedAt, + timestamps.
- **inbox**: text, capturedVia, suggested{...}.
- **vehicles**: name, nickname, type(car/motorcycle/boat/other), brand, model,
  variant, year, color, interiorColor, plate, vin, engineNo, purchaseDate,
  purchasePrice, currentValue, dealer, country, location, mileage, engineHours,
  fuel, tankCapacity, battery, tyres, bio, photo, gallery[], insuranceCompany,
  policyNumber, policyStart, policyExpiry, warrantyExpiry.
- **services**: vehicleId→vehicles, date, odo, workshop, work, parts, cost, invoice,
  notes, nextDate, nextOdo, kind(oil/tyre/brake/inspection…).
- **accessories**: vehicleId, name, category, brand, partNo, purchaseDate, price,
  installDate, installer, warranty, status(installed/ordered/planned/removed).
- **expenses**: amount, currency, date, time, merchant, category, subcategory,
  description, method, receipt, notes, recurring, classification, reimbursable,
  reimbursed, relatedVehicle, relatedPerson, relatedProject, relatedTrip, location,
  tags.
- **people**: name, photo, jobTitle, company, mobile, email, whatsapp, notes,
  relationship, lastInteraction, nextFollowUp.
- **documents**: title, category, relatedVehicle, relatedTask, relatedExpense,
  relatedTrip, issueDate, expiry, reminder, notes, fileUrl, tags.
- **trips**: name, destination, start, end, participants[], vehicleId, route,
  activities, reservations[], packingList[], budget, notes, emergency.
- **notes**: text.
- **notifications**: (Phase 1 = computed live; Phase 2 = persisted for snooze/read).

## Settings (single object)
name, language, currency(SAR default), timezone(Asia/Riyadh), dateFormat, theme,
requireLock, aiProvider, monthlyBudget.

## Supabase schema (Phase 2 — reference DDL)
Every table has RLS `owner_id = auth.uid()`. Timestamps + soft delete everywhere.

```sql
-- Helper: standard columns
--   id uuid pk default gen_random_uuid()
--   owner_id uuid not null references auth.users(id)
--   created_at timestamptz default now()
--   updated_at timestamptz default now()
--   deleted_at timestamptz

create table profiles (
  id uuid primary key references auth.users(id),
  name text, language text default 'en', currency text default 'SAR',
  timezone text default 'Asia/Riyadh', date_format text default 'DD MMM YYYY',
  theme text default 'system', settings jsonb default '{}'::jsonb,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text not null, description text,
  type text, classification text, priority text, status text,
  start_date date, due_date date, due_time time, reminder_at timestamptz,
  project text, department text,
  requested_by uuid references people(id), assigned_to uuid references people(id),
  people uuid[] default '{}', tags text[] default '{}',
  completion_pct int default 0, follow_up date, recurrence jsonb,
  related_vehicle uuid references vehicles(id),
  related_trip uuid references trips(id),
  completed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on tasks (owner_id, status);
create index on tasks (owner_id, due_date);
create index on tasks (owner_id, assigned_to);

create table people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null, photo_url text, job_title text, company text,
  mobile text, email text, whatsapp text, notes text,
  relationship text, last_interaction date, next_follow_up date,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on people (owner_id);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text, nickname text, type text, brand text, model text, variant text,
  year int, color text, interior_color text, plate text, vin text, engine_no text,
  purchase_date date, purchase_price numeric, current_value numeric,
  dealer text, country text, location text, mileage text, engine_hours numeric,
  fuel text, tank_capacity text, battery text, tyres text,
  bio text, photo_url text, gallery jsonb default '[]',
  insurance_company text, policy_number text, policy_start date, policy_expiry date,
  warranty_expiry date,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on vehicles (owner_id, type);
create index on vehicles (owner_id, policy_expiry);

create table services (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  vehicle_id uuid not null references vehicles(id),
  date date, odo text, workshop text, work text, parts text,
  cost numeric, invoice_url text, notes text, next_date date, next_odo text, kind text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on services (owner_id, vehicle_id);

create table accessories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  vehicle_id uuid references vehicles(id),
  name text, category text, brand text, part_no text,
  purchase_date date, price numeric, install_date date, installer text,
  warranty text, status text, notes text,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  amount numeric not null, currency text default 'SAR',
  date date, time time, merchant text, category text, subcategory text,
  description text, method text, receipt_url text, notes text,
  recurring boolean default false, classification text,
  reimbursable boolean default false, reimbursed boolean default false,
  related_vehicle uuid references vehicles(id),
  related_person uuid references people(id),
  related_trip uuid references trips(id),
  location text, tags text[] default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on expenses (owner_id, date);
create index on expenses (owner_id, category);
create index on expenses (owner_id, related_vehicle);

create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  title text, category text,
  related_vehicle uuid references vehicles(id),
  related_task uuid references tasks(id),
  related_trip uuid references trips(id),
  issue_date date, expiry date, reminder_at timestamptz, notes text,
  file_url text, tags text[] default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index on documents (owner_id, expiry);

create table trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text, destination text, start date, "end" date,
  participants text[] default '{}', vehicle_id uuid references vehicles(id),
  route jsonb, activities jsonb, budget numeric, notes text, emergency text,
  packing_list jsonb default '[]',
  created_at timestamptz default now(), updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table trip_days (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  trip_id uuid not null references trips(id),
  day_date date, start_point text, destination text, distance numeric,
  ride_time text, fuel_stops jsonb, rest_stops jsonb, notes text
);

create table reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  trip_id uuid references trips(id),
  kind text, title text, ref text, date date, notes text, file_url text
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  text text, created_at timestamptz default now(),
  updated_at timestamptz default now(), deleted_at timestamptz
);

create table inbox_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  text text, captured_via text, suggested jsonb,
  created_at timestamptz default now(), deleted_at timestamptz
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  kind text, title text, body text, due_at timestamptz,
  read_at timestamptz, snoozed_until timestamptz, ref_table text, ref_id uuid,
  created_at timestamptz default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  action text, entity text, entity_id uuid, meta jsonb,
  created_at timestamptz default now()
);

-- Row Level Security (apply to every table)
alter table tasks enable row level security;
create policy owner_all on tasks
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- …repeat the enable + policy for every table above.
```

## Migration plan (Phase 1 → 2)
1. Add `store/supabaseAdapter.js` implementing `db.js`'s API against these tables.
2. On first sign‑in, push local collections up (bulk insert with new `owner_id`).
3. Thereafter reconcile by `updated_at` (last‑write‑wins per record); `deleted_at`
   propagates soft deletes. No screen code changes.
