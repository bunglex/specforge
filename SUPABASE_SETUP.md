# Supabase database bootstrap for SpecForge

If your project database is empty, you need **both**:

1. schema creation (tables + policies), and
2. seed data (demo rows tied to a real auth user).

This repo already includes both SQL files:

- `supabase/schema.sql` → creates tables/RLS/policies
- `supabase/seed.sql` → inserts demo data

## 1) Create the tables first (required)

In Supabase Dashboard → **SQL Editor** → **New query**, paste and run the entire contents of:

- `supabase/schema.sql`

> Supabase already provisions the Postgres database for your project. Running `schema.sql` is the step that creates your app tables inside that database.

## 2) Confirm tables exist

Run this in SQL Editor:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('workspaces', 'workspace_members', 'modules', 'tags', 'taxonomy')
order by table_name;
```

You should see all 5 table names.

## 3) Create a user for seed ownership

In Supabase Dashboard → **Authentication** → **Users**, create a user (email/password) and copy that user's UUID.

## 4) Seed demo rows

Open `supabase/seed.sql`, replace:

- `YOUR_AUTH_USER_ID_HERE`

with the UUID from step 3, then run `seed.sql` in SQL Editor.

## 5) Configure local env

Set these in `.env` (or `.env.local`):

```bash
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

## 6) Run app and verify

```bash
npm install
npm run dev
```

Sign in with the seeded user. The dashboard should show non-zero data for workspaces/modules/tags/taxonomy.
