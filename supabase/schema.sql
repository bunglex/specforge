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

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.modules enable row level security;
alter table public.tags enable row level security;
alter table public.taxonomy enable row level security;

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
