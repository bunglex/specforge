# Spec Writer Local Setup

## 1) Install and run

```bash
npm install
npm run dev
```

Vite starts the app locally (typically at http://localhost:5173).

## 2) Environment variables

Create a `.env.local` file in the repository root:

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

Notes:
- `.env.local` is ignored by git and should never be committed.
- `VITE_` prefix is required for browser exposure in Vite.

## 3) Apply schema + seed (self-hosted or SQL editor workflow)

Run SQL in this order:
1. `supabase/schema.sql`
2. `supabase/seed.sql`

Before running the seed script, replace `YOUR_AUTH_USER_ID_HERE` with your actual Auth user UUID so your account is attached to the demo workspace.

## 4) What gets created

Schema includes:
- Core workspace membership tables (`workspaces`, `workspace_members`)
- Existing metadata tables (`tags`, `taxonomy`, `modules`)
- New app tables:
  - `documents` (structured document sections + variable values)
  - `clause_library` (reusable clauses with taxonomy + tags)

Seed includes:
- 1 demo workspace
- taxonomy + tags
- example clauses with placeholders (`{{client_name}}` style)
- one example document with sections and variables
