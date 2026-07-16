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
| `@supabase/supabase-js` | ^2.108.1 | Client for the `units` table (status/notes/is_urgent persistence). Requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. |

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
2. **Supabase `units` table** — source of truth for mutable state: `status`, `notes`, `is_urgent`. Rows are keyed to the GeoJSON by `full_address`.

The merge happens client-side on load: every GeoJSON feature is matched to a Supabase row by `full_address`; if no row exists yet, the unit gets default state (`status: 'none'`) and a `null` id. Saving a unit for the first time inserts a new Supabase row rather than requiring pre-seeded data.

**Why `full_address` as the join key (not `parcel_id`):** `parcel_id` was originally used to match GeoJSON rows to Supabase rows but proved unreliable/not unique across the dataset (see commit `9ab06d3`). `full_address` is guaranteed unique per unit and is now the only matching key. `parcel_id` is still carried through as a display field but must not be used for identity/matching again.

## Key decisions

### Data layer
- **GeoJSON is immutable source of truth for geometry; Supabase is source of truth for status.** Never write coordinates/addresses back to Supabase from the app — they always come from the GeoJSON file on every load.
- **`full_address` is the unique matching key** between the two data sources (see above). `parcel_id` was dropped from matching logic because it wasn't reliably unique.
- **Units without a Supabase row are valid state**, not an error — they render as `status: 'none'` (blue) until someone sets a status, at which point `updateUnit` inserts the row.
- **`is_urgent` is used throughout the app** (`useUnits.js`, `UnitPopup.jsx`, `MapView.jsx`) but is **not present in `supabase_schema.sql`** (only `status` and `notes` are in the checked-in schema). This means the actual Supabase table has a column that the schema file doesn't document — the migration was applied directly and never backported to the SQL file. **TODO: update `supabase_schema.sql` to add `is_urgent boolean default false`** so a fresh environment can be provisioned from the file alone.

### Map behavior (MapView.jsx)
- **Bounding box locks the map to the HOA + immediate surrounding roads** (`MAX_BOUNDS`), so users can't pan away into the rest of Pennsylvania.
- **`minZoom: 15`, `maxZoom: 19`** — zoomed out caps at roughly a 100m view of the neighborhood; there's no reason to zoom out further for this use case, and zooming in past 19 doesn't add useful detail on top of Mapbox's street tiles.
- **Marker (circle) radius scales with zoom** via a `interpolate`/`linear` zoom expression, tuned smaller at low zoom (2–4px) and larger at high zoom (10–16px) — dense clusters of 732 units are unreadable at low zoom if markers are full-size, so this keeps the map legible while still giving a clear, clickable target once zoomed in.
- **Street address numbers only render as text labels above zoom 17.5** (`text-size` step expression) — showing all 732 address labels at low zoom would be unreadable clutter; they only appear once zoomed in enough to read them individually.
- **Separate hover layer (`units-circles-hover`)** duplicates the circle layer but is filtered to a single feature id and swapped via `map.setFilter` on `mousemove`/`mouseleave`, rather than using Mapbox's built-in feature-state hover — this was the reliable approach for a filter-driven hover highlight without needing `generateId`/promoteId wiring.
- **Urgent units get a white ring layer** (`units-urgent-ring`) drawn independently, filtered by `is_urgent === true`, sized slightly larger than the base marker — so urgency is visible as a halo at a glance without overriding the status color.
- **Status → color mapping is a single shared Mapbox `match` expression** (`STATUS_COLOR_EXPR`) reused by the base layer, hover layer, and (implicitly) drives the legend colors in `StatsPanel` — keep these two in sync manually if a status or color ever changes, since they aren't currently derived from one shared config.
- **Popups are rendered as real React components** mounted into a DOM node via `ReactDOM.createRoot`, not raw HTML strings — this lets the popup use full React state/handlers (status buttons, notes textarea, save) instead of manually wiring DOM events.
- **Map style toggle (streets/satellite) re-adds all layers on `style.load`** because calling `setStyle` on Mapbox wipes and reloads the entire style, including custom sources/layers — `addMapLayers` is deliberately factored out so it can be called both on initial load and after every style swap.
- **A ref (`mapStyleReady`) guards the style-toggle effect from firing on mount** — otherwise the effect would call `setStyle` while the initial style is still loading and silently cancel it, dropping the first data render.
- **Source data updates check `map.getSource(SOURCE_ID)` exists rather than `map.isStyleLoaded()`** — `isStyleLoaded()` can return `false` during the brief style-reload window and would silently drop a data update if used as the guard.

### UI / UX (StatsPanel.jsx, UnitPopup.jsx, App.jsx)
- **Legend panel doubles as the filter control** — clicking a status in `StatsPanel` filters the map to only that status (toggle on/off), rather than having separate legend and filter UI.
- **Legend panel is collapsible** to get it out of the way on smaller screens/when focused on the map.
- **Search box flies the map to a matched unit and auto-opens its popup** (`App.jsx handleSearch` → `MapView`'s `searchTarget` effect), matching against both `full_address` and `street_name` (case-insensitive substring match) — simple first-match search, not a full autocomplete/geocoder.
- **Clearing the search input immediately re-clears the search** (`onSearch('')` fires on empty input, not just on submit) for a snappier feel.
- **Status colors are consistent across the whole app**: red = needs work, yellow = in progress, green = completed, blue = no status — used in the map circles, the legend dots, and the popup's status buttons/badge.
- **Urgency is a separate boolean toggle from status**, not a fifth status value — a unit can be, e.g., "needs work" *and* urgent at the same time, which is why it's a white ring overlay rather than a color.
- **Map style toggle (streets/satellite) lives top-right as its own control**, independent of the legend panel, since it's a map display preference rather than a data filter.

## File / function reference

- **`src/App.jsx`** — top-level layout and state owner. Holds `activeFilter`, `searchTarget`, `mapStyle`; wires `useUnits()` into `MapView` and `StatsPanel`. `handleSearch` does the address/street-name lookup for the search box.
- **`src/hooks/useUnits.js`** — all data fetching/merging/persistence.
  - `loadUnits()` — fetches the GeoJSON + Supabase rows, merges them by `full_address`, sets `units` state. Runs once on mount.
  - `updateUnit(unit, updates)` — inserts a new Supabase row if `unit.id` is null, otherwise updates the existing row; then patches local `units` state so the UI reflects the save immediately without a full reload.
- **`src/components/MapView.jsx`** — all Mapbox setup and rendering.
  - `addMapLayers(map, unitsRef, hoveredIdRef, openPopup)` — adds the geojson source and the four layers (urgent ring, base circles, hover circles, address labels), plus hover/click handlers. Called on initial map load and again after every style swap.
  - `unitsToGeoJSON(units)` — converts the app's unit objects into a GeoJSON `FeatureCollection` for the Mapbox source, filtering out any unit missing lat/lon.
  - `openPopup(map, unit, lngLat)` / `closePopup()` — mount/unmount the React-rendered `UnitPopup` into a Mapbox popup; `openPopup`'s `renderPopup` closure lets the popup re-render itself with fresh data after a save without closing and reopening.
  - Effects: init map (once), sync source data on `units` change, apply/clear `activeFilter` as a Mapbox filter, fly-to + auto-open popup on `searchTarget`, swap style on `mapStyle` change.
- **`src/components/UnitPopup.jsx`** — the per-unit edit form (status buttons, urgency toggle, notes textarea, save button). Local state is seeded from `unit` and reset whenever `unit.id` changes (i.e., a different unit is opened). `handleSave` calls the `onSave` prop (wired to `updateUnit` via `MapView`) and shows a transient "Saved!" state.
- **`src/components/StatsPanel.jsx`** — legend + filter + search UI, top-left. `counts` (memoized) tallies units per status for the legend numbers. Also owns the collapse/expand state for the panel itself.
- **`src/lib/supabase.js`** — Supabase client instance, configured from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` env vars (see `.env.example`).
- **`supabase_schema.sql`** — DDL for the `units` table. **Out of date** — missing `is_urgent` (see Data layer decisions above). Run in the Supabase SQL editor to provision a new environment.

## Known gaps / open items for the team

- `supabase_schema.sql` doesn't include `is_urgent` — fix before anyone provisions a fresh Supabase project from this file.
- No auth on Supabase RLS policies — `select`/`update`/`insert` are all open to anyone with the anon key (`using (true)`). Fine for an internal HOA tool behind an unlisted URL, but worth revisiting if this ever gets a real login.
- Search is a simple case-insensitive substring match on the first hit — no ranking, no autocomplete dropdown. Would need work if the address list grows or search becomes a primary interaction.
- Status → color mapping is duplicated (Mapbox expression in `MapView.jsx` + `STATUS_CONFIG`/`STATUS_BUTTON` objects in `StatsPanel.jsx`/`UnitPopup.jsx`) rather than derived from one shared constant — update all three spots together if a status or color ever changes.

## Build history (chronological)

1. `initial working build` — scaffolded Vite/React app, Supabase schema, GeoJSON import, base map.
2. `732 markers showing legend fixed` — got all units rendering with working legend counts.
3. `full_address as unique key, parcel_id removed from matching` — fixed unreliable parcel-based matching.
4. `clickable units and all shown` → `minZoom/maxZoom set` → `boundaries set` — locked map interaction and pan/zoom range to the HOA area.
5. `larger markers at high zoom only` / `address numbers zoom and larger dots` — tuned marker size and label visibility per zoom level for legibility.
6. `re-sizing complete` — larger refactor of `MapView.jsx` (net -78 lines) consolidating the sizing/zoom logic.
7. `stable before urgent feature` (current `HEAD`) — added the urgency toggle/ring across `MapView`, `UnitPopup`, and `useUnits`.

Next up, per the last commit message: an "urgent feature" was being staged — check with Cole on what specifically is planned beyond the urgency toggle already in place (e.g. dedicated urgent-only filter/view?).
