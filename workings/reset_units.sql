-- Run ONCE in the Supabase SQL editor.
--
-- The `units` table accumulated ~1,526 rows for ~732 addresses (the seed
-- script ran 2-3 times) with no UNIQUE constraint on full_address, which
-- made unit edits non-deterministic — the app bound to a random duplicate
-- and changes appeared to vanish on refresh.
--
-- All current data is mock, so the simplest fix is to wipe both tables and
-- add the constraint. The app does NOT need pre-seeded rows: `useUnits`
-- renders every GeoJSON address as status 'none' with no tasks until the
-- first save, which lazily inserts the row.
--
-- (To dedupe REAL data instead of wiping, see workings/dedupe_units.sql in
-- git history — commit 8e7571c.)

begin;

truncate table projects, units;

alter table units drop constraint if exists units_full_address_key;
alter table units add constraint units_full_address_key unique (full_address);

commit;

-- Verify: both should be 0.
--   select (select count(*) from units) as units, (select count(*) from projects) as projects;
