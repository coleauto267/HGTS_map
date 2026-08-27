# Languages used in this project, and their job

## JavaScript (React)
Does the actual work: handles clicks, form input, talking to Supabase, controlling the map.
- Files: everything in `src/` ending in `.jsx` or `.js`
- Example: `src/hooks/useUnits.js` — `updateUnit()` is the function that runs when you hit "Save" in the popup. It calls Supabase to write the change.

## SQL (Postgres, via Supabase)
Defines the database tables/columns, and stores/retrieves the data. Never runs on its own — only runs when JavaScript asks it to (via Supabase's API).
- File: `supabase_schema.sql`
- Example: `create table units (...)` defines what a row looks like. `default now()` and triggers are SQL telling Postgres to fill in dates automatically.

## CSS (Tailwind)
Controls appearance — colors, spacing, layout. Written inline as class names on elements rather than in separate `.css` files (that's the Tailwind approach).
- Example: `className="bg-red-500 text-white rounded-lg px-3 py-2"` on a button in `src/components/UnitPopup.jsx`

## HTML (as JSX)
The structure of the page — buttons, dropdowns, text. In this project it's written as JSX, which looks like HTML mixed into JavaScript, and gets converted to real HTML when the app runs.
- Example: `<button onClick={...}>Save</button>` inside `src/components/UnitPopup.jsx`

---

## How they work together (one example: clicking "Save")
1. **JS** detects the click.
2. **JS** collects the form values (status, notes, etc.) and calls `supabase.from('units').update(...)`.
3. Supabase turns that into **SQL** and runs it against Postgres.
4. Postgres stores the change and confirms back to **JS**.
5. **JS** updates the UI to show "Saved!"

**CSS** and **HTML/JSX** aren't part of that flow — they only control what the button and form *look like*, not what happens when you click.
