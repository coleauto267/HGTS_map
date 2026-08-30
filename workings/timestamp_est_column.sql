-- Run ONCE in the Supabase SQL editor against the live database.
--
-- Goal: `updated_at` goes back to being a plain Postgres-managed UTC
-- timestamp (sortable, good for reporting), and a new `updated_at_est`
-- column carries the SAME moment rendered as US Eastern clock time
-- (MM/DD/YYYY HH:MM:SS AM/PM) so the raw tables are legible to a staffer
-- if the UI is down. Both are kept current by a trigger — the app no
-- longer sends either value.

-- 1. New legible-EST column on both tables.
alter table units    add column if not exists updated_at_est text;
alter table projects add column if not exists updated_at_est text;

-- 2. Trigger function: on every insert/update, stamp both columns.
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

-- 3. Attach it (drop first so this script is safe to re-run).
drop trigger if exists units_set_updated_at on units;
create trigger units_set_updated_at
  before insert or update on units
  for each row execute function set_updated_at();

drop trigger if exists projects_set_updated_at on projects;
create trigger projects_set_updated_at
  before insert or update on projects
  for each row execute function set_updated_at();

-- 4. Backfill updated_at_est for existing rows by reformatting whatever is
--    already in updated_at. Historic values are a mix (some UTC, some EST
--    from a brief earlier approach), so a few backfilled strings may be
--    off by the UTC offset — acceptable for audit data, and the trigger
--    rewrites both columns correctly the next time any row is touched.
update units
  set updated_at_est = to_char(updated_at, 'MM/DD/YYYY HH12:MI:SS AM')
  where updated_at_est is null and updated_at is not null;
update projects
  set updated_at_est = to_char(updated_at, 'MM/DD/YYYY HH12:MI:SS AM')
  where updated_at_est is null and updated_at is not null;

-- Verify:
--   select updated_at, updated_at_est from projects order by updated_at desc limit 5;
