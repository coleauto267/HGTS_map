-- Run this in the Supabase SQL editor to create the units and projects tables.
-- For an EXISTING project migrating from the old single-table design,
-- use workings/migration.sql instead — this file is for a fresh install.

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  full_address text not null unique,
  street_name text,
  lat double precision,
  lon double precision,
  occupant text,
  phone text,
  email text,
  universal_key boolean default false,
  status text default 'none' check (status in ('none', 'needs_work', 'in_progress', 'completed')),
  updated_at timestamp default now(),        -- real UTC timestamp, trigger-maintained
  updated_at_est text                        -- same moment, legible EST clock time, trigger-maintained
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  task text check (task in ('bathroom', 'kitchen', 'tub', 'cabinet', 'waterline', 'floor', 'beam')),
  status text default 'open' check (status in ('open', 'done')),
  priority text default 'low' check (priority in ('low', 'medium', 'urgent')),
  date_added date,
  date_completed date,
  notes text,
  updated_at timestamp default now(),        -- real UTC timestamp, trigger-maintained
  updated_at_est text                        -- same moment, legible EST clock time, trigger-maintained
);

-- Keep updated_at / updated_at_est current on every write, in Postgres rather
-- than app code. updated_at stays a real UTC timestamp (sortable, good for
-- reporting); updated_at_est is the same instant rendered as US Eastern
-- clock time (MM/DD/YYYY HH:MM:SS AM/PM) so the tables are legible raw.
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  new.updated_at_est := to_char(
    now() at time zone 'America/New_York',
    'MM/DD/YYYY HH12:MI:SS AM'
  );
  return new;
end;
$$ language plpgsql;

create trigger units_set_updated_at
  before insert or update on units
  for each row execute function set_updated_at();

create trigger projects_set_updated_at
  before insert or update on projects
  for each row execute function set_updated_at();

-- Indexes for fast filtering/reporting
create index if not exists idx_units_status on units(status);
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
