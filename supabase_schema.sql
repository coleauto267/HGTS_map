-- Run this in the Supabase SQL editor to create the units and projects tables.
-- For an EXISTING project migrating from the old single-table design,
-- use workings/migration.sql instead — this file is for a fresh install.

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  full_address text not null,
  street_name text,
  lat double precision,
  lon double precision,
  occupant text,
  phone text,
  email text,
  universal_key boolean default false,
  updated_at timestamp default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  task text check (task in ('bathroom', 'kitchen', 'tub', 'cabinet', 'waterline', 'floor', 'beam')),
  status text default 'needs_work' check (status in ('needs_work', 'in_progress', 'completed')),
  priority text default 'low' check (priority in ('low', 'medium', 'urgent', 'emergency')),
  date_added date,
  date_completed date,
  notes text,
  updated_at timestamp default now()
);

-- Indexes for fast filtering/reporting
create index if not exists idx_projects_unit_id on projects(unit_id);
create index if not exists idx_projects_task on projects(task);
create index if not exists idx_projects_status on projects(status);

-- Enable row-level security (RLS) — adjust policies to suit your auth requirements
alter table units enable row level security;
alter table projects enable row level security;

-- Policies: open to anyone with the anon key (matches the rest of the app)
create policy "Allow read for all" on units for select using (true);
create policy "Allow update for all" on units for update using (true);
create policy "Allow insert for all" on units for insert with check (true);

create policy "Allow read for all" on projects for select using (true);
create policy "Allow update for all" on projects for update using (true);
create policy "Allow insert for all" on projects for insert with check (true);
create policy "Allow delete for all" on projects for delete using (true);
