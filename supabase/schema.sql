-- SpecForge schema for Supabase

create extension if not exists pgcrypto;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  override_html text,
  variables_schema jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.taxonomy (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_name text,
  title text not null,
  structure jsonb not null default '{"sections":[]}'::jsonb,
  variable_values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clause_library (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  taxonomy_id uuid references public.taxonomy(id) on delete set null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clause_library_workspace_idx on public.clause_library(workspace_id);
create index if not exists documents_workspace_idx on public.documents(workspace_id);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.modules enable row level security;
alter table public.tags enable row level security;
alter table public.taxonomy enable row level security;
alter table public.documents enable row level security;
alter table public.clause_library enable row level security;

drop policy if exists workspaces_select_for_members on public.workspaces;
create policy workspaces_select_for_members
  on public.workspaces
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = workspaces.id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists workspace_members_select_own on public.workspace_members;
create policy workspace_members_select_own
  on public.workspace_members
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists modules_select_for_members on public.modules;
create policy modules_select_for_members
  on public.modules
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = modules.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists tags_select_for_members on public.tags;
create policy tags_select_for_members
  on public.tags
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = tags.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists taxonomy_select_for_members on public.taxonomy;
create policy taxonomy_select_for_members
  on public.taxonomy
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = taxonomy.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists documents_select_for_members on public.documents;
create policy documents_select_for_members
  on public.documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists documents_insert_for_members on public.documents;
create policy documents_insert_for_members
  on public.documents
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists documents_update_for_members on public.documents;
create policy documents_update_for_members
  on public.documents
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = documents.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists clause_library_select_for_members on public.clause_library;
create policy clause_library_select_for_members
  on public.clause_library
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = clause_library.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists clause_library_insert_for_members on public.clause_library;
create policy clause_library_insert_for_members
  on public.clause_library
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = clause_library.workspace_id
        and wm.user_id = auth.uid()
    )
  );

drop policy if exists clause_library_update_for_members on public.clause_library;
create policy clause_library_update_for_members
  on public.clause_library
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = clause_library.workspace_id
        and wm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = clause_library.workspace_id
        and wm.user_id = auth.uid()
    )
  );
