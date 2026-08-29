-- Run ONCE in the Supabase SQL editor.
--
-- Problem: the `units` table has ~1,526 rows for ~732 addresses because the
-- original seed/import script was run 2-3 times, inserting a full copy of
-- every address each time. There is no UNIQUE constraint on `full_address`,
-- so nothing stopped the duplicates. The app loads all copies of an address
-- and arbitrarily binds to whichever comes last, so edits land on a row that
-- a later page load doesn't surface -> "my changes disappeared".
--
-- This script keeps ONE row per address (the one with real data / most
-- recently touched), moves every `projects` row onto that survivor, deletes
-- the duplicates, and adds a UNIQUE constraint so it can't recur.
--
-- No real data is lost: the survivor is chosen to be the row that has your
-- status/contact/key edits.

-- ---------------------------------------------------------------------------
-- OPTIONAL dry run — see the split before changing anything.
-- rn = 1 is the survivor for each address; rn > 1 rows will be deleted.
--
--   with ranked as (
--     select full_address, status, occupant, universal_key, updated_at,
--       row_number() over (partition by full_address order by
--         (coalesce(status,'none') <> 'none') desc,
--         (coalesce(occupant,'') <> '') desc,
--         (coalesce(phone,'') <> '') desc,
--         (coalesce(email,'') <> '') desc,
--         (universal_key is true) desc,
--         updated_at desc nulls last) as rn
--     from units)
--   select rn, count(*) from ranked group by rn order by rn;
-- ---------------------------------------------------------------------------

begin;

-- 1. Re-point projects off the soon-to-be-deleted duplicates onto the
--    survivor for the same address. MUST run before the delete:
--    projects.unit_id is ON DELETE CASCADE, so deleting a duplicate unit
--    row first would drag its tasks out with it.
with ranked as (
  select
    id,
    full_address,
    row_number() over (
      partition by full_address
      order by
        (coalesce(status, 'none') <> 'none') desc,
        (coalesce(occupant, '') <> '') desc,
        (coalesce(phone, '') <> '') desc,
        (coalesce(email, '') <> '') desc,
        (universal_key is true) desc,
        updated_at desc nulls last
    ) as rn
  from units
),
survivor as (
  select full_address, id as keep_id from ranked where rn = 1
)
update projects p
set unit_id = s.keep_id
from ranked r
join survivor s on s.full_address = r.full_address
where p.unit_id = r.id
  and r.rn > 1;

-- 2. Delete every row that isn't the survivor for its address.
with ranked as (
  select
    id,
    row_number() over (
      partition by full_address
      order by
        (coalesce(status, 'none') <> 'none') desc,
        (coalesce(occupant, '') <> '') desc,
        (coalesce(phone, '') <> '') desc,
        (coalesce(email, '') <> '') desc,
        (universal_key is true) desc,
        updated_at desc nulls last
    ) as rn
  from units
)
delete from units u
using ranked r
where u.id = r.id
  and r.rn > 1;

-- 3. One row per address, enforced by the database from here on.
alter table units add constraint units_full_address_key unique (full_address);

commit;

-- ---------------------------------------------------------------------------
-- Verify — the two counts should now match (~732):
--   select count(*) as total_rows, count(distinct full_address) as addresses from units;
-- ---------------------------------------------------------------------------
