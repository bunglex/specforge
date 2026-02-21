-- SpecForge seed data
-- Replace this placeholder with the UUID from Authentication > Users.
-- Example: '11111111-2222-3333-4444-555555555555'

with workspace as (
  insert into public.workspaces (name, slug)
  values ('SpecForge Demo Workspace', 'specforge-demo')
  on conflict (slug) do update set name = excluded.name
  returning id
),
resolved_workspace as (
  select id from workspace
  union all
  select id from public.workspaces where slug = 'specforge-demo' limit 1
)
insert into public.workspace_members (workspace_id, user_id, role)
select id, 'YOUR_AUTH_USER_ID_HERE'::uuid, 'owner' from resolved_workspace
on conflict (workspace_id, user_id) do update set role = excluded.role;

with target_workspace as (
  select id from public.workspaces where slug = 'specforge-demo' limit 1
)
insert into public.modules (workspace_id, name, title, override_html, variables_schema)
select
  tw.id,
  v.name,
  v.title,
  v.override_html,
  v.variables_schema::jsonb
from target_workspace tw
cross join (
  values
    (
      'Product Requirements',
      'PRD Generator',
      '<section><h2>PRD Preview</h2><p>Use variables below to shape your requirement doc.</p></section>',
      '[
        {"key":"feature_name","label":"Feature name","type":"text","required":true,"placeholder":"Smart routing"},
        {"key":"target_user","label":"Target user","type":"text","placeholder":"Growth PM"},
        {"key":"constraints","label":"Constraints","type":"textarea","placeholder":"Latency under 200ms"}
      ]'
    ),
    (
      'Technical Design',
      'Tech Spec Generator',
      '<section><h2>Tech Spec Preview</h2><p>Capture architecture and rollout details.</p></section>',
      '[
        {"key":"service_name","label":"Service","type":"text","required":true,"placeholder":"specforge-api"},
        {"key":"sla","label":"SLA","type":"text","placeholder":"99.9%"}
      ]'
    )
) as v(name, title, override_html, variables_schema)
where not exists (
  select 1
  from public.modules m
  where m.workspace_id = tw.id
    and m.name = v.name
);

with target_workspace as (
  select id from public.workspaces where slug = 'specforge-demo' limit 1
)
insert into public.tags (workspace_id, name)
select tw.id, v.name
from target_workspace tw
cross join (
  values ('frontend'), ('backend'), ('security'), ('performance')
) as v(name)
where not exists (
  select 1
  from public.tags t
  where t.workspace_id = tw.id
    and t.name = v.name
);

with target_workspace as (
  select id from public.workspaces where slug = 'specforge-demo' limit 1
)
insert into public.taxonomy (workspace_id, name, category)
select tw.id, v.name, v.category
from target_workspace tw
cross join (
  values
    ('MVP', 'stage'),
    ('Iteration', 'stage'),
    ('Core Experience', 'priority')
) as v(name, category)
where not exists (
  select 1
  from public.taxonomy tx
  where tx.workspace_id = tw.id
    and tx.name = v.name
    and coalesce(tx.category, '') = coalesce(v.category, '')
);
