# Decisions

Living log of what this project is, the decisions made building it, and how the code is organized. Read this before picking up work — it should get you oriented faster than re-reading every commit.

## What this is

A maintenance-tracking map for the Warminster Heights (HGTS) HOA. It plots every unit/address in the community on a Mapbox map, color-coded by maintenance status, and lets a user click a unit to set its status, mark it urgent, and leave notes. Status/notes persist to Supabase; the addresses and coordinates themselves come from a static GeoJSON file.

**Stack:** React 19 + Vite, Mapbox GL JS (`mapbox-gl`), Supabase (Postgres) for mutable state, Tailwind CSS for UI.

## Dependencies

From `package.json`. Runtime dependencies:

| Package | Version | Purpose |
|---|---|---|
| `react` / `react-dom` | ^19.2.6 | UI framework — component tree for the whole app. |
| `mapbox-gl` | ^3.24.0 | The map itself — rendering, layers, zoom/pan, popups. Requires `VITE_MAPBOX_TOKEN`. |
| `@supabase/supabase-js` | ^2.108.1 | Client for the `units` table (status/notes/urgency/job_title persistence). Requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. |
| `@tabler/icons-react` | ^3.45.0 | Icon set used in `UnitPopup.jsx` (view-toggle and universal-key icons) — the rest of the app still uses hand-rolled inline SVGs. |

Dev/build dependencies:

| Package | Version | Purpose |
|---|---|---|
| `vite` | ^8.0.12 | Dev server + build tool. |
| `@vitejs/plugin-react` | ^6.0.1 | Vite's React plugin (JSX/Fast Refresh). |
| `tailwindcss` | ^3.4.19 | Utility-first CSS, used throughout every component. |
| `postcss` / `autoprefixer` | ^8.5.15 / ^10.5.0 | CSS pipeline Tailwind runs on. |
| `eslint` | ^10.3.0 | Linting. |
| `eslint-plugin-react-hooks` | ^7.1.1 | Enforces hooks rules (relevant given how much `MapView.jsx` leans on `useEffect`/refs). |
| `eslint-plugin-react-refresh` | ^0.5.2 | Ensures components stay compatible with Fast Refresh. |
| `@types/react` / `@types/react-dom` | ^19.2.14 / ^19.2.3 | Type defs for editor tooling (project itself is plain JS, not TS). |
| `globals` | ^17.6.0 | Global variable definitions used by the ESLint config. |

**External services (not npm packages, but required to run the app):**
- **Mapbox** — needs an access token (`VITE_MAPBOX_TOKEN`) with a style/tiles budget; the app uses `mapbox://styles/mapbox/streets-v12` and `satellite-streets-v12`.
- **Supabase project** — needs a `units` table (see `supabase_schema.sql`, and the schema-drift note below) plus a URL/anon key.

No test runner, TypeScript, or state-management library is in use — state is plain React hooks (`useState`/`useEffect`/refs), no Redux/Zustand/etc.

## Architecture / data flow

Two data sources are merged in `useUnits`:

1. **`public/HGTS_Addresses.geojson`** — source of truth for identity, address, and coordinates (732 units). Static, checked into the repo, not editable by the app.
2. **Supabase `units` table** — source of truth for mutable state: `status`, `notes`, `urgency`, `job_title`, `occupant`, `phone`, `email`, `universal_key`. Rows are keyed to the GeoJSON by `full_address`.

The merge happens client-side on load: every GeoJSON feature is matched to a Supabase row by `full_address`; if no row exists yet, the unit gets default state (`status: 'none'`) and a `null` id. Saving a unit for the first time inserts a new Supabase row rather than requiring pre-seeded data.

**Why `full_address` as the join key (not `parcel_id`):** `parcel_id` was originally used to match GeoJSON rows to Supabase rows but proved unreliable/not unique across the dataset (see commit `9ab06d3`). `full_address` is guaranteed unique per unit and is now the only matching key. `parcel_id` is still carried through as a display field but must not be used for identity/matching again.

## Key decisions

### Data layer
- **GeoJSON is immutable source of truth for geometry; Supabase is source of truth for status.** Never write coordinates/addresses back to Supabase from the app — they always come from the GeoJSON file on every load.
- **`full_address` is the unique matching key** between the two data sources (see above). `parcel_id` was dropped from matching logic because it wasn't reliably unique.
- **Units without a Supabase row are valid state**, not an error — they render as `status: 'none'` (blue) until someone sets a status, at which point `updateUnit` inserts the row.
- **`supabase_schema.sql` now declares all mutable columns** (`status`, `notes`, `is_urgent`, `occupant`, `phone`, `email`, `universal_key`) in its `CREATE TABLE`. This does **not** mean a running environment actually has them — see the gotcha below.
- **`CREATE TABLE IF NOT EXISTS` is a no-op on a table that already exists — it will not retroactively add new columns.** This bit us directly: `occupant`/`phone`/`email`/`universal_key` were added to `supabase_schema.sql` and to `UnitPopup.jsx`'s save payload, but the *live* Supabase table still lacked those columns, so `updateUnit` failed (Postgrest error `PGRST204` / `42703`, "column does not exist") for **every** save, including a plain status toggle — because `handleSave` always sends the full payload (status, notes, is_urgent, occupant, phone, email, universal_key) in one request, and Postgrest rejects the whole request if any field doesn't match a real column. Diagnosed by hitting the REST endpoint directly with `fetch` from the browser console to read the actual Postgrest error (the app only logs `Save failed: [object Object]`, which hides the real message). **Fix: any time a new column is added to `supabase_schema.sql` for an environment that already has the table, run an explicit `ALTER TABLE units ADD COLUMN IF NOT EXISTS ...` against that environment** — re-running the schema file alone will not do it.
- **`full_address` has no database-level unique constraint** — while checking the fix above, found a pre-existing orphan duplicate row for one address (two rows created a fraction of a second apart, one `status: 'none'`, one with the real status), unrelated to this session's changes. Harmless today since `full_address` is only used as a client-side join key and the merge just takes whichever row comes back last, but worth a cleanup pass / considering a unique constraint if it becomes a pattern.
- **`is_urgent` (boolean) is deprecated in favor of `urgency` (text, 4 levels)** — the app no longer reads or writes `is_urgent` anywhere; it was replaced end-to-end (`UnitPopup.jsx`, `useUnits.js`, `MapView.jsx`) by a `urgency` column (`'low' | 'medium' | 'urgent' | 'emergency'`, default `'low'`). The old column was **left in place in `supabase_schema.sql`** rather than dropped, since dropping a column on a live table is destructive and unnecessary just to stop using it. Same for `job_title text[]` (new, holds a multi-select of job categories) — both are additive columns following the same `CREATE TABLE IF NOT EXISTS` gotcha above: **an existing Supabase environment needs `ALTER TABLE units ADD COLUMN IF NOT EXISTS urgency text default 'low' check (urgency in ('low','medium','urgent','emergency'));` and `ALTER TABLE units ADD COLUMN IF NOT EXISTS job_title text[] default '{}';`** run manually before saves using either field will work. **(Superseded — see below.)**
- **Superseded the single-`units`-table design entirely with a `units` + `projects` split**, in response to client-requested granularity (see Known gaps for the original request). `status`, `notes`, `urgency`, and `job_title` were removed from `units` and now live as columns on a new `projects` table instead — a unit can have many `projects` rows (one per category of work: bathroom, kitchen, tub, cabinet, waterline, floor, beam), each with its own `status`, `priority`, `date_added`, `date_completed`, and `notes`. `parcel_id`, `is_urgent`, and `created_at` were dropped from `units` entirely (parcel_id/is_urgent were unused; created_at was low-value since units are only inserted lazily on first save, not at "creation"). `units` keeps `updated_at`; `projects` keeps `updated_at` only (no `created_at` — decided redundant with the more meaningful `date_added`). **`updated_at` is set by app code (JS) on every save, not a Postgres trigger** — deliberately kept simple/readable over "more correct." Full design walkthrough (why two tables, what each column is for, id vs. foreign key, etc.) is in `workings/languages.md` and the planning conversation that produced `workings/migration.sql`. **This was applied directly against the live database** (`workings/migration.sql`, run manually in the Supabase SQL editor — placeholder status data was intentionally discarded, not migrated) **before the application code was updated to match** — `useUnits.js`/`UnitPopup.jsx`/`MapView.jsx` still reference the old single-table shape as of this commit and the app does not currently run. This was a deliberate sequencing choice (database first, UI second) since the app has no live users yet.

### Status/priority/color design for `units` + `projects` (verbatim from Cole, 2026-08-27)

Recorded word-for-word as written, superseding earlier speculation in this file about how unit color/halo would be computed from projects (that speculation assumed unit status would be *derived* from project status — it is not; see below). Nothing described here has been implemented yet — decisions and open items only.

> Status:
>
> unit(dot) color will be determined by the units overall status. This is set manual by the user and not influenced by any given task's status. Units will have the same 3 statuses and colors they have now.
>
> task (once "job") status will exist independent and only be visible when a user clicks deeper into the unit. a task's status is binary. Either open or done(closed). I want it to be visually "crossed out" in the UI, like a real-life punch list. When crossing off a task, that task will be done/completed AKA "part of the units history"
>
> Open item:
>
> We may connect the 2 tables' Status for automatic and accurate unit colors
> ex. no tasks left = dot automatically turns green
>
> Priority:
>
> Priority (in projects) will be 3 options. (small, medium and urgent) They will be represented as "outer rings" of the dots (like the old binary "urgent" worked). Their colors will be
>
> - No ring - low priority)
> - white ring- medium priority
> - yellow ring - urgent
>
> Open Item:
> We may add a boolean column called "Emergency" either off or on. I will override any priority. Maybe there will be an "!" on top of the unit dot, lets plan for that. Do not add the "emergency" column. Just take note of it.

### Map behavior (MapView.jsx)
- **Bounding box locks the map to the HOA + immediate surrounding roads** (`MAX_BOUNDS`), so users can't pan away into the rest of Pennsylvania.
- **`minZoom: 15`, `maxZoom: 19`** — zoomed out caps at roughly a 100m view of the neighborhood; there's no reason to zoom out further for this use case, and zooming in past 19 doesn't add useful detail on top of Mapbox's street tiles.
- **Marker (circle) radius scales with zoom** via a `interpolate`/`linear` zoom expression, tuned smaller at low zoom (2–4px) and larger at high zoom (10–16px) — dense clusters of 732 units are unreadable at low zoom if markers are full-size, so this keeps the map legible while still giving a clear, clickable target once zoomed in.
- **Street address numbers only render as text labels above zoom 17.5** (`text-size` step expression) — showing all 732 address labels at low zoom would be unreadable clutter; they only appear once zoomed in enough to read them individually.
- **Separate hover layer (`units-circles-hover`)** duplicates the circle layer but is filtered to a single feature id and swapped via `map.setFilter` on `mousemove`/`mouseleave`, rather than using Mapbox's built-in feature-state hover — this was the reliable approach for a filter-driven hover highlight without needing `generateId`/promoteId wiring.
- **Urgent units get a white ring layer** (`units-urgent-ring`) drawn independently, sized slightly larger than the base marker — so urgency is visible as a halo at a glance without overriding the status color. **The ring shows for the top two severity levels only** (`urgency` is `'urgent'` or `'emergency'`, via `['in', ['get','urgency'], ['literal', ['urgent','emergency']]]`) — `'low'`/`'medium'` don't get a halo. This filter combines with the active status filter (`['all', isUrgentExpr, ['==', ['get','status'], activeFilter]]` when a filter is set, else just `isUrgentExpr`) — originally the ring's filter was set once at layer creation and never updated on `activeFilter` changes, so halos for every status stayed visible even when the map was filtered to a single status. Fixed by re-applying this combined filter in the same effect that filters the base/label layers. (This layer/filter predates the `urgency` field — it originally keyed off the boolean `is_urgent`, see the Data layer note on that deprecation.)
- **Status → color mapping is a single shared Mapbox `match` expression** (`STATUS_COLOR_EXPR`) reused by the base layer, hover layer, and (implicitly) drives the legend colors in `StatsPanel` — keep these two in sync manually if a status or color ever changes, since they aren't currently derived from one shared config.
- **Popups are rendered as real React components** mounted into a DOM node via `ReactDOM.createRoot`, not raw HTML strings — this lets the popup use full React state/handlers (status buttons, notes textarea, save) instead of manually wiring DOM events.
- **Map style toggle (streets/satellite) re-adds all layers on `style.load`** because calling `setStyle` on Mapbox wipes and reloads the entire style, including custom sources/layers — `addMapLayers` is deliberately factored out so it can be called both on initial load and after every style swap.
- **A ref (`mapStyleReady`) guards the style-toggle effect from firing on mount** — otherwise the effect would call `setStyle` while the initial style is still loading and silently cancel it, dropping the first data render.
- **Source data updates check `map.getSource(SOURCE_ID)` exists rather than `map.isStyleLoaded()`** — `isStyleLoaded()` can return `false` during the brief style-reload window and would silently drop a data update if used as the guard.

### UI / UX (StatsPanel.jsx, UnitPopup.jsx, App.jsx)
- **Legend panel doubles as the filter control** — clicking a status in `StatsPanel` filters the map to only that status (toggle on/off), rather than having separate legend and filter UI.
- **Legend panel is collapsible** to get it out of the way on smaller screens/when focused on the map.
- **Filter chips use an explicit "All Units" option plus one chip per status**, styled as bordered buttons rather than a plain list — each status chip shows a colored dot when inactive and switches to a solid-color background + colored ring + checkmark icon when active, so the currently-selected filter is unambiguous at a glance. This replaced an earlier version where a small "Clear filter" text link sat next to the section header instead of being a first-class option in the same button group.
- **`UnitPopup`'s status buttons reuse this same chip pattern** (muted/outlined when unselected, colored + ring when selected) instead of all four status buttons being permanently solid-colored — previously every status button was fully saturated all the time, so nothing visually distinguished the selected status from the other three.
- **Selecting "Needs Work" / "In Progress" / "Completed" (not "All Units" or "No Status") reveals a scrollable address list** beneath the Total row in `StatsPanel`, capped at `max-h-48` with a themed slim scrollbar (`.address-list-scroll` in `index.css`). **Clicking an address in this list flies the map to that unit and opens its status popup** — it does this by calling `onAddressSelect(unit)` (wired straight to `App.jsx`'s `setSearchTarget`), reusing `MapView`'s existing `searchTarget` fly-to/popup effect rather than adding a second code path.
- **Section divider borders (header/search/total/address-list in `StatsPanel`; header/body in `UnitPopup`) are thin (2px) and bright (`border-white/25`–`/30`)** rather than thick/grey — tuned specifically so sections read as visually split apart without the dark theme feeling heavy-handed.
- **`UnitPopup`'s outer card has no outer border** (just `shadow-2xl`) — a border there was tried and explicitly removed per feedback; only the header/body divider uses a border now.
- **`UnitPopup`'s status control lives inline in the header next to the address, and is itself the editable control** (not a read-only badge) — a native `<select>` (`STATUS_OPTIONS`) styled as a small pill, colored per status via `STATUS_BUTTON`, with a manually-drawn chevron overlay (`pointer-events-none` SVG) since the pill is too small for the browser's default arrow to look right. Changing status no longer requires opening the body of the card at all. Same for the street-name/zip subline, which was dropped entirely to shorten the card.
- **`UnitPopup` is single-column (`w-96`) and swaps between two "views" via a header icon toggle**, instead of the old down-arrow that expanded the card's height in place. `activeView` (`'status' | 'details'`) is reset to `'status'` in the same effect that resets the rest of the form state when `unit.id` changes. The toggle button uses `@tabler/icons-react`'s `IconLayoutSidebarRight`/`IconLayoutSidebar`, swapping icon with the view. The body wrapper has a fixed `min-h-[17.5rem]` — re-measured (via `getBoundingClientRect` with `min-height` temporarily zeroed) each time a field moved in or out of a view — so toggling between views doesn't resize the card. **If fields are ever added to or removed from either view, re-measure and adjust this value**, or the card will visibly resize on toggle.
  - **View `'status'` (default)**: Job Title (multi-select dropdown), Urgency (single-select dropdown), Notes (`rows={2}`).
  - **View `'details'`**: Occupant, Phone, Email inputs only.
  - **Save Changes is pinned outside/below both views** at the bottom of the card body, so it's reachable regardless of which view is active, without needing its own view.
- **Universal Key is a single icon-only toggle, not a labeled Yes/No button pair.** Originally floated top-right inside the `'status'` view's content; **moved into the header's icon row** (next to the view-toggle and Close buttons) once Status vacated the body for the header pill and nothing was left above the urgency control for it to float over without overlapping. Uses `IconKey` from `@tabler/icons-react` colored `text-red-500` (no key) or `text-green-500` (has key) — no text label, per explicit feedback against the earlier bordered Yes/No buttons.
- **Job Title is a multi-select dropdown** (`JOB_TITLE_OPTIONS`: Bathroom, Kitchen, Floor, Full Rehab — client-facing category tags, not mutually exclusive) — closed state shows a comma-joined summary of selections (or a placeholder), open state is a custom checkbox list (not a native `<select multiple>`, which is hard to style/use well for multi-pick). Built as a controlled button + absolutely-positioned panel with an outside-click listener (`jobTitleRef` + a `mousedown` document listener) rather than `<details>`, to match the app's existing dropdown look. **This requires the outer card wrapper to not have `overflow-hidden`** — it was removed for this reason; the rounded corners still render fine without it since no child element paints its own background past the card's border-radius.
- **Urgency changed from a boolean "Mark as Urgent" toggle switch to a 4-level dropdown** (`URGENCY_OPTIONS`: Low/Medium/Urgent/Emergency, default `'low'`) — styled like a compact version of the header status `<select>` (colored left dot via `URGENCY_DOT`, native `<select>` under the hood) but full-width in the body rather than a header pill, since it isn't as central as Status. See the Data layer note on the underlying `is_urgent` → `urgency` column migration.
- **A UI mockup for a possible "Job Title changes which fields show" redesign was explored but not built** — client feedback (see Known gaps) suggests Job Title may become a list of per-category "projects" (each with its own status/priority/dates/notes) rather than a flat multi-select tag on the unit; this is a bigger data-model change than a UI tweak and is intentionally on hold pending a decision on how it relates to the unit-level Status/Urgency fields documented above.
- **Parcel ID is no longer displayed anywhere in `UnitPopup`** — it was a low-value read-only caption at the bottom of the card; removed to shorten the card per feedback. The `unit.parcel_id` field itself is untouched (still comes through from the GeoJSON, still shown in `StatsPanel`/elsewhere if referenced), just not rendered in the popup.
- **Search box flies the map to a matched unit and auto-opens its popup** (`App.jsx handleSearch` → `MapView`'s `searchTarget` effect), matching against both `full_address` and `street_name` (case-insensitive substring match) — simple first-match search, not a full autocomplete/geocoder.
- **Clearing the search input immediately re-clears the search** (`onSearch('')` fires on empty input, not just on submit) for a snappier feel.
- **Status colors are consistent across the whole app**: red = needs work, yellow = in progress, green = completed, blue = no status — used in the map circles, the legend dots, and the popup's status buttons/badge.
- **Urgency is a separate field from status** (now a 4-level dropdown, not a boolean — see UI/UX notes below), not a fifth status value — a unit can be, e.g., "needs work" *and* "emergency" urgency at the same time, which is why it's a white ring overlay rather than folded into the status color.
- **Map style toggle (streets/satellite) lives top-right as its own control**, independent of the legend panel, since it's a map display preference rather than a data filter.

### Styling gotchas (index.css)
- **`mapbox-gl.css`'s own `.mapboxgl-popup-content` rule (white background, padding, rounded corners, box-shadow) can win over our reset in `index.css`** even though our rule is defined later in source, because Vite bundles `mapbox-gl/dist/mapbox-gl.css` (imported from `MapView.jsx`) after `index.css` in the final CSS output — same specificity, later-in-cascade wins. This showed up as an unwanted white border/margin around `UnitPopup`. **Fixed by bumping the reset's selector specificity** to `.mapboxgl-popup .mapboxgl-popup-content` (two classes vs. mapbox's one), which wins regardless of bundle order. If a future Mapbox default style isn't being overridden as expected, check for this same order-of-import issue before assuming the CSS itself is wrong.

## File / function reference

- **`src/App.jsx`** — top-level layout and state owner. Holds `activeFilter`, `searchTarget`, `mapStyle`; wires `useUnits()` into `MapView` and `StatsPanel`. `handleSearch` does the address/street-name lookup for the search box. `onAddressSelect={setSearchTarget}` is passed straight into `StatsPanel` so clicking an address in its list reuses the same `searchTarget` flow as a manual search.
- **`src/hooks/useUnits.js`** — all data fetching/merging/persistence.
  - `loadUnits()` — fetches the GeoJSON + Supabase rows, merges them by `full_address`, sets `units` state. Runs once on mount.
  - `updateUnit(unit, updates)` — inserts a new Supabase row if `unit.id` is null, otherwise updates the existing row; then patches local `units` state so the UI reflects the save immediately without a full reload.
- **`src/components/MapView.jsx`** — all Mapbox setup and rendering.
  - `addMapLayers(map, unitsRef, hoveredIdRef, openPopup)` — adds the geojson source and the four layers (urgent ring, base circles, hover circles, address labels), plus hover/click handlers. Called on initial map load and again after every style swap.
  - `unitsToGeoJSON(units)` — converts the app's unit objects into a GeoJSON `FeatureCollection` for the Mapbox source, filtering out any unit missing lat/lon.
  - `openPopup(map, unit, lngLat)` / `closePopup()` — mount/unmount the React-rendered `UnitPopup` into a Mapbox popup; `openPopup`'s `renderPopup` closure lets the popup re-render itself with fresh data after a save without closing and reopening.
  - Effects: init map (once), sync source data on `units` change, apply/clear `activeFilter` as a Mapbox filter, fly-to + auto-open popup on `searchTarget`, swap style on `mapStyle` change.
- **`src/components/UnitPopup.jsx`** — the per-unit edit form. Local state is seeded from `unit` and reset whenever `unit.id` changes (i.e., a different unit is opened), including `activeView` and `jobTitleMenuOpen` (see below). `handleSave` calls the `onSave` prop (wired to `updateUnit` via `MapView`) and shows a transient "Saved!" state. `STATUS_BUTTON` is the solid-color style for the header status `<select>` pill; `URGENCY_DOT` is the colored-dot lookup for the Urgency dropdown; `JOB_TITLE_OPTIONS`/`URGENCY_OPTIONS` are the two dropdowns' option lists. `activeView` (`'status' | 'details'`) controls which of the two views renders — see the UI/UX section above for what each view contains. `toggleJobTitle` adds/removes a single title from the `jobTitles` array state (multi-select semantics).
- **`src/components/StatsPanel.jsx`** — legend + filter + search UI, top-left. `counts` (memoized) tallies units per status for the legend numbers. `filteredUnits` (memoized) holds the sorted list of units matching `activeFilter` when it's one of `needs_work`/`in_progress`/`completed` (`LISTABLE_STATUSES`) — renders as the clickable address list under the Total row, each calling the `onAddressSelect` prop with the full unit object. Also owns the collapse/expand state for the panel itself.
- **`src/lib/supabase.js`** — Supabase client instance, configured from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars (see `.env.example`).
- **`supabase_schema.sql`** — DDL for the `units` table, including all mutable columns. Only drives *new* environments — see the `CREATE TABLE IF NOT EXISTS` gotcha under Data layer decisions above before assuming it reflects what an existing Supabase project actually has.

## Known gaps / open items for the team

- No auth on Supabase RLS policies — `select`/`update`/`insert` are all open to anyone with the anon key (`using (true)`). Fine for an internal HOA tool behind an unlisted URL, but worth revisiting if this ever gets a real login.
- Search is a simple case-insensitive substring match on the first hit — no ranking, no autocomplete dropdown. Would need work if the address list grows or search becomes a primary interaction.
- Status → color mapping is duplicated (Mapbox expression in `MapView.jsx` + `STATUS_CONFIG`/`STATUS_BUTTON`/`STATUS_CHIP` objects in `StatsPanel.jsx`/`UnitPopup.jsx`) rather than derived from one shared constant — update all spots together if a status or color ever changes.
- **The `UnitPopup` card can render partially off-screen** when the clicked unit is near the top/edge of the viewport — Mapbox's automatic popup anchor placement picks a direction (above/below/left/right) to avoid overflow but doesn't shrink or clamp the popup itself, so a marker near the top combined with a tall card can still push content above the visible viewport. Raised and intentionally left unaddressed this session (declined); the fix on the table if revisited is capping the card's height (`max-h-[...] overflow-y-auto`) so it always fits within the viewport regardless of anchor direction.
- **`full_address` has no unique constraint in Supabase** — see the orphan-duplicate note under Data layer decisions. Not causing visible problems today, but a cleanup/constraint pass would prevent it recurring.
- ~~Live Supabase environments need two manual `ALTER TABLE`s before urgency/job_title saves work~~ — **resolved, moot**: `urgency`/`job_title` no longer live on `units` at all, see the `units` + `projects` split above.
- ~~Client requested a bigger "projects" feature; architecture decision pending~~ — **decision made, schema built**: the client email (relayed 2026-07-24) asking for per-category subcategories, priority levels, dated line-items, and cross-unit reporting/filtering (full detail preserved in git history — see the Data layer note above for the resolution) drove the `units`/`projects` split. The open item now is narrower — see below.
- **The application code has not been updated for the new `units`/`projects` schema — the app does not currently run.** `useUnits.js`, `UnitPopup.jsx`, and `MapView.jsx` still read/write `status`, `notes`, `urgency`, `job_title`, and `parcel_id` directly on `units`, all of which were dropped from the live table by `workings/migration.sql`. **This is the next task**: rewrite the data layer to fetch/join `projects` per unit, and redesign `UnitPopup.jsx` around a list of per-unit projects instead of flat unit-level fields. Decided in planning: multiple simultaneous projects per unit should display as a **collapsible accordion** (one section per project, collapsed by default) rather than tabs or all-expanded. Also decided: no rolled-up "one status" badge is stored on `units` — if an at-a-glance summary is wanted on the map/popup later, compute it live from that unit's `projects` rather than storing a second copy of the truth that can drift.
- **Cross-unit filtering/reporting by category (client asks 4 and 7) is not yet designed** — e.g. "show all units needing beams" or "count bathrooms completed Feb–Mar 2026." The `projects` table (indexed on `category` and `status`) supports these queries, but no UI exists for them yet. Sequence after `UnitPopup.jsx` is rebuilt against `projects`.

## Build history (chronological)

1. `initial working build` — scaffolded Vite/React app, Supabase schema, GeoJSON import, base map.
2. `732 markers showing legend fixed` — got all units rendering with working legend counts.
3. `full_address as unique key, parcel_id removed from matching` — fixed unreliable parcel-based matching.
4. `clickable units and all shown` → `minZoom/maxZoom set` → `boundaries set` — locked map interaction and pan/zoom range to the HOA area.
5. `larger markers at high zoom only` / `address numbers zoom and larger dots` — tuned marker size and label visibility per zoom level for legibility.
6. `re-sizing complete` — larger refactor of `MapView.jsx` (net -78 lines) consolidating the sizing/zoom logic.
7. `stable before urgent feature` — added the urgency toggle/ring across `MapView`, `UnitPopup`, and `useUnits`.
8. `Fix urgent ring halo not respecting status filter` — the urgent-ring Mapbox layer now combines `is_urgent` with `activeFilter` instead of only ever filtering on `is_urgent`.
9. `halo ring fix and status buttton` — `StatsPanel`'s filter list redesigned into an explicit "All Units" + per-status button group with colored active states and a checkmark, replacing the old plain list + "Clear filter" text link.
10. `Add clickable address list to status filter panel` — scrollable, clickable address list appears under the Total row when a status filter is active; clicking an address reuses the search box's fly-to/popup flow via a new `onAddressSelect` prop.
11. `Redesign status popup and refine card borders/dividers` — `UnitPopup`'s status buttons switched to the same muted/selected chip pattern as `StatsPanel`; section dividers on both cards tuned to thin+bright; `UnitPopup`'s outer border removed; fixed a CSS specificity bug where `mapbox-gl.css`'s default popup styling was overriding our reset.
12. `Add occupant/phone/email/universal-key fields to unit popup` — added the four new mutable fields to `useUnits.js`, `UnitPopup.jsx`, and `supabase_schema.sql`; initially broke saving for existing environments because the live Supabase table wasn't migrated (see the `CREATE TABLE IF NOT EXISTS` gotcha under Data layer decisions) — fixed by running an `ALTER TABLE` against the live table.
13. `unit card horizontal` — reworked `UnitPopup` into a 3-column horizontal layout (status/urgent | notes/save | occupant/contact/key) with the status pill moved into the header. Short-lived design, superseded by #14.
14. `Stack unit card into a single column, drop parcel ID` — reverted the horizontal layout back to a single column, reordered to Set Status → Urgency → Notes → More Details toggle → expandable contact fields → Save (pinned last), and removed the read-only Parcel ID caption.
15. `card view updated` — replaced the "More Details" expand-in-place arrow with a header icon toggle (`@tabler/icons-react`) that switches the body between two fixed-height views instead of resizing the card; see the `UnitPopup.jsx` UI/UX notes above for the exact view split.
16. `key icon` — replaced the Universal Key Yes/No text-button pair with a single icon-only toggle (red/green key, no text), moved from the details view into the status view.
17. Compressed the status control into a header dropdown pill (native `<select>`, replacing the old row of 4 buttons in the body); moved the Universal Key toggle into the header icon row to avoid overlapping the body content that used to sit above it; added a **Job Title** multi-select dropdown (Bathroom/Kitchen/Floor/Full Rehab) with a custom checkbox-list panel; replaced the boolean **"Mark as Urgent"** toggle with a 4-level **Urgency** dropdown (Low/Medium/Urgent/Emergency); added `urgency`/`job_title` columns to `supabase_schema.sql` and wired them through `useUnits.js`/`MapView.jsx`, deprecating (not dropping) `is_urgent`. Re-measured the card's fixed body height after removing/relocating fields.
18. **`units` + `projects` table split** (schema/database only — no app code changed yet) — client requested per-category granularity (bathrooms, kitchens, tubs, cabinets, waterlines, floors, beams), dated line-items, and cross-unit reporting/filtering by category. Designed and applied a new `projects` table (one row per category of work per unit, FK'd via `unit_id`, holding its own `status`/`priority`/`date_added`/`date_completed`/`notes`); dropped `status`/`notes`/`urgency`/`job_title`/`parcel_id`/`is_urgent`/`created_at` from `units`, keeping only identity/contact fields + `updated_at`. Rewrote `supabase_schema.sql` to the new fresh-install shape and added `workings/migration.sql` for the live-database migration (run manually by Cole in the Supabase SQL editor; existing placeholder status data was intentionally discarded, not migrated). Added `workings/languages.md` as a plain-language reference to what each language (JS/SQL/CSS/HTML) does in this project, for learning purposes. **App code intentionally not yet updated to match** — see Known gaps.

**Next up: rewrite the application code for the new `units`/`projects` schema — the app does not currently run.** Start with `useUnits.js` (fetch/join projects per unit), then `UnitPopup.jsx` (list of projects, collapsible accordion per project, add/edit/remove). See Known gaps for the decisions already made (accordion over tabs, no stored rolled-up status). Other open items: cross-unit filter/report views by category, and the `full_address` duplicate-row cleanup.
