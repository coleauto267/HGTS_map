-- Run this ONCE in the Supabase SQL editor to migrate the LIVE units table
-- to the new units + projects design. This drops columns — status/notes/
-- urgency/job_title data on existing rows is deleted permanently (confirmed
-- OK to lose, it was placeholder data).

-- 1. Create the new projects table
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references units(id) on delete cascade,
  category text check (category in ('bathroom', 'kitchen', 'tub', 'cabinet', 'waterline', 'floor', 'beam')),
  status text default 'needs_work' check (status in ('needs_work', 'in_progress', 'completed')),
  priority text default 'low' check (priority in ('low', 'medium', 'urgent', 'emergency')),
  date_added date,
  date_completed date,
  notes text,
  updated_at timestamp default now()
);

create index if not exists idx_projects_unit_id on projects(unit_id);
create index if not exists idx_projects_category on projects(category);
create index if not exists idx_projects_status on projects(status);

alter table projects enable row level security;
create policy "Allow read for all" on projects for select using (true);
create policy "Allow update for all" on projects for update using (true);
create policy "Allow insert for all" on projects for insert with check (true);
create policy "Allow delete for all" on projects for delete using (true);

-- 2. Drop the columns that moved to projects (or are unused), from units
alter table units drop column if exists parcel_id;
alter table units drop column if exists is_urgent;
alter table units drop column if exists created_at;
alter table units drop column if exists status;
alter table units drop column if exists notes;
alter table units drop column if exists urgency;
alter table units drop column if exists job_title;
