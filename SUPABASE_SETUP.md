# Supabase database bootstrap for SpecForge

If your project is brand new/empty, setup has 3 parts:

1. create a Supabase **project** (this provisions the Postgres database),
2. run schema SQL (creates tables + policies), and
3. run seed SQL (inserts demo rows tied to an auth user).

This repo includes the SQL files for parts 2 and 3:

- `supabase/schema.sql` → creates tables/RLS/policies
- `supabase/seed.sql` → inserts demo data

## 1) Create the Supabase project (database)

If you do not already have a Supabase project:

1. Go to https://supabase.com/dashboard.
2. Click **New project**.
3. Choose org, project name, database password, and region.
4. Wait for provisioning to finish.

That provisioning step creates the Postgres database for you. You do **not** separately create a database with SQL like `CREATE DATABASE` in hosted Supabase.

## 2) Create the app tables (required)

In Supabase Dashboard → **SQL Editor** → **New query**, paste and run the entire contents of:

- `supabase/schema.sql`

## 3) Confirm tables exist

Run this in SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('workspaces', 'workspace_members', 'modules', 'tags', 'taxonomy')
order by table_name;
```

You should see all 5 table names.

## 4) Create a user for seed ownership

In Supabase Dashboard → **Authentication** → **Users**, create a user (email/password) and copy that user's UUID.

## 5) Seed demo rows

Open `supabase/seed.sql`, replace:

- `YOUR_AUTH_USER_ID_HERE`

with the UUID from step 4, then run `seed.sql` in SQL Editor.

## 6) Configure local env

Set these in `.env` (or `.env.local`):

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 7) Run app and verify

```bash
npm install
npm run dev
```

Sign in with the seeded user. The dashboard should show non-zero data for workspaces/modules/tags/taxonomy.

## How the setup page loads data

The app does not have a separate backend setup route; it loads directly from Supabase in the browser:

1. On boot, `main.js` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and creates a Supabase client.
2. It checks the current auth session.
3. After sign-in (or existing session), it queries `workspaces`, `modules`, `tags`, and `taxonomy`.
4. The seeded data cards/counts render from those query results.
5. If tables are missing or empty, the UI shows diagnostics and guidance.

So if you see no data, it is usually one of: missing env vars, not signed in, schema not run, seed not run, or user UUID mismatch in `seed.sql`.
