# SpecForge / Spec Writer Local Setup

## 1) Install and run

```bash
npm install
npm run dev
```

Vite starts locally (usually `http://localhost:5173`).

## 2) Environment variables (`.env.local`)

Create `.env.local` at repo root:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 3) Apply Supabase schema + seed

Run SQL in this order:
1. `supabase/schema.sql`
2. `supabase/seed.sql`

Before seeding, replace `YOUR_AUTH_USER_ID_HERE` with your Auth user UUID.

The app expects these existing tables and works with them directly:
- `workspaces`
- `workspace_members`
- `taxonomy`
- `tags`
- `clause_library`
- `documents`
- `modules`

## 4) Editor interaction model

The app uses a 3-pane shell:
- **Left sidebar**: section contents + taxonomy tree + clause quick insert/search.
- **Middle canvas**: section/block rendering with variable-token highlight + resolved preview.
- **Right inspector**: block edit panel (version `basic|standard|robust`, tags, lock/include toggles, variable insert/create).

Behavior highlights:
- Clicking a section in contents smoothly scrolls and briefly highlights that section.
- Clicking a block opens the inspector.
- **Insert Clause** opens a searchable picker with taxonomy/tag filters.
- Variables (`{{variable_name}}`) are reusable and stored per-document in `documents.variable_values`.

## 5) Common errors and fixes

- **Missing `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY`**: set `.env.local` and restart `npm run dev`.
- **No workspaces visible after login**: verify `workspace_members` contains your `auth.users.id` for a workspace.
- **Seed fails on UUID cast**: replace `YOUR_AUTH_USER_ID_HERE` before running `supabase/seed.sql`.
- **Editor/document load failures**: confirm RLS policies from `supabase/schema.sql` are applied and your user is a workspace member.
