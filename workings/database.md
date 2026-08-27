# Database basics — plain language notes

Learning notes from working through this project's database design. Written for someone new to databases/SQL.

## What Supabase actually is
Supabase = a hosted Postgres database + an auto-generated API sitting in front of it. The app talks to Supabase over the internet (via `@supabase/supabase-js`), not a direct database connection.

## How a click becomes a database change
Nothing happens "in SQL" on its own. The flow is:
1. **JavaScript** detects the click (e.g. hitting Save).
2. **JavaScript** calls Supabase's API with the new values.
3. Supabase turns that into **SQL** and runs it against Postgres.
4. Postgres stores it and confirms back.

SQL only runs when JavaScript asks it to — it never runs by itself in the background.

## Why we split into two tables (`units` + `projects`)
One table can hold one value per column per row just fine (a property's occupant, phone, etc.). It breaks down when something needs to hold a *list* — like "this property needs bathroom work AND kitchen work." Cramming a list into one row is messy and makes filtering/reporting hard.

**The fix:** a second table, where each row is one item in that list.
- `units` = one row per property (identity, contact info)
- `projects` = one row per piece of work on a property (job, status, priority, dates, notes)

A property with 3 issues = 3 rows in `projects`, not 3 columns crammed into 1 row.

## `id` vs `unit_id` — the pointer between tables
- `units.id` — every property's own unique ID.
- `projects.unit_id` — a *copy* of a `units.id` value, stored on each project row, saying "this project belongs to that property."

This is called a **foreign key**. `unit_id` is the pointer; `units.id` is what it points at.

## Why `id` exists when `full_address` looks unique enough
`id` is for the computer — permanent, meaningless to a person, guaranteed unique by the database itself. `full_address` is for the human — readable, but just text, and not database-enforced as unique.

If you linked tables using `full_address` instead of `id`, fixing a typo in an address would silently break every project pointing at the old text. `id` never changes, so the link never breaks.

## Why `full_address` AND `street_name` both exist
`full_address` = one property's exact identity ("13 Grier St"). `street_name` = just the street ("Grier St"), kept as its own column so filtering by street is a clean exact match instead of having to chop up `full_address` every time. Both come pre-split from the source data file — not extra manual work.

## How the two tables actually relate
They don't "talk" continuously — there's no live connection running between them. The relationship only matters when the app asks a question, using a **join**:

```sql
select units.full_address, projects.job, projects.status
from units
join projects on projects.unit_id = units.id
where units.full_address = '1 Adams St';
```

`join ... on` matches rows by ID, for every unit in the database. `where` is what narrows it down to one property. Remove the `where` and you'd get every project for every unit at once.

**Relationship shape:** one-to-many. One `units` row can have many `projects` rows. `units` is the parent, `projects` are the children.

## `created_at`/`updated_at` vs `date_added`/`date_completed`
Two different jobs:
- `created_at` / `updated_at` — automatic, set by the database itself, can't be backdated. Just "when was this row last touched."
- `date_added` / `date_completed` — manual, user-entered, *can* be backdated (e.g. logging today an issue first noticed last month). These are the ones that actually matter for reporting.

`updated_at` is one timestamp per **row**, not per column — changing any single field (occupant, status, whatever) overwrites the same timestamp. It doesn't track which field changed or what the old value was.

## Why `job` (and `status`, `priority`) are restricted options, not free text
If `job` were a plain text box, someone could type "beems" instead of "beams." Filtering (`where job = 'beams'`) would silently miss that row — no error, just wrong results. Restricting it to a fixed list (dropdown in the UI + a `check` constraint in SQL) makes bad data impossible to enter in the first place. (This column was originally called `category` — renamed to `job` for clarity, same restricted-list idea either way.)

## Filtering in the UI without anyone typing SQL
Filtering is just a query — the user never sees or types it. They click a button (e.g. "Beams"), and JavaScript translates that click into a query automatically:

```js
supabase.from('projects').select('*').eq('job', 'beams')
```

Same pattern the app already uses for status filter chips.

## How project history works — no separate history table
`projects` acts as its own history, as long as we follow **one rule: never overwrite or reset an old row — always add a new one.**

- A completed project isn't deleted. It just sits there with `status = 'completed'` and a `date_completed`.
- If the same category needs work again later (e.g. a second bathroom issue years after the first was completed), that becomes a **brand-new row** — not a reset of the old one.

**What makes two jobs in the same category "different" jobs?** Not their status or dates — it's that they're separate rows, each with its own `id`. Two rows could even have identical status/date/notes and still be two different jobs, purely because they're two different rows. Status and dates are just details a person reads to tell them apart at a glance; the database tells them apart by row identity alone.

## Open item: materials (not built, idea only)

If reporting ever needs to go a level deeper than job type — down to specific materials used (grout, 2x4 lumber, PEX pipe) — that's a different *shape* of relationship than `units → projects`, worth having on record:

- `units → projects` is **one-to-many**: one unit has many projects. Needed only one foreign key (`unit_id` on `projects`).
- `projects → materials` would be **many-to-many**: one project can use many materials, and the same material gets reused across many different projects. That needs a **junction table** in between, not just one foreign key.

Shape, if built:
- **`materials`** — the master list/catalog of every possible material. Could grow to hundreds of rows. Adding a new one is just inserting a row, not editing a `check` constraint (unlike `job`, which is a short fixed list — materials are too abundant/varied for that).
- **`project_materials`** — the junction table. One row per (project, material) pairing — e.g. `project_id`, `material_id`, `quantity`. This is what actually assigns a material to a specific job.

**Status: not built, not requested yet.** `notes` on `projects` covers "what materials were used" fine until there's a real, confirmed need for material-level reporting. Documented here so the shape is ready if that need comes up.
