-- Run this in the Supabase SQL editor to create the units table

create table if not exists units (
  id uuid primary key default gen_random_uuid(),
  full_address text not null,
  street_name text,
  parcel_id text,
  lat double precision,
  lon double precision,
  status text default 'none' check (status in ('none', 'needs_work', 'in_progress', 'completed')),
  notes text,
  is_urgent boolean default false,
  occupant text,
  phone text,
  email text,
  universal_key boolean default false,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

-- Index for fast status filtering
create index if not exists idx_units_status on units(status);

-- Enable row-level security (RLS) — adjust policies to suit your auth requirements
alter table units enable row level security;

-- Policy: allow all authenticated users to read
create policy "Allow read for all" on units
  for select using (true);

-- Policy: allow all authenticated users to update
create policy "Allow update for all" on units
  for update using (true);

-- Policy: allow insert (needed for initial seed)
create policy "Allow insert for all" on units
  for insert with check (true);
