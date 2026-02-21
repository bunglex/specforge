# Supabase reset + seed for SpecForge

This project expects these tables in `public`:

- `workspaces`
- `workspace_members`
- `modules`
- `tags`
- `taxonomy` (optional in the app, but included here)

## 1) Run the schema

In your Supabase SQL Editor, run:

```sql
\i supabase/schema.sql
```

If your SQL editor does not support `\i`, paste the file content manually.

## 2) Create a user

Create a user in **Authentication > Users** (email + password), then copy the user UUID.

## 3) Seed data for that user

Open `supabase/seed.sql`, replace `YOUR_AUTH_USER_ID_HERE` with that UUID, then run the SQL.

## 4) Configure local env

Set these in your `.env` (or `.env.local`):

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 5) Verify app

```bash
npm install
npm run dev
```

Sign in with the seeded user. You should see non-zero counts for workspaces/modules/tags/taxonomy.
