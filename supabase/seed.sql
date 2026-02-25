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
insert into public.tags (workspace_id, name)
select tw.id, v.name
from target_workspace tw
cross join (
  values ('legal'), ('security'), ('compliance'), ('delivery')
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
    ('Commercial', 'domain'),
    ('Implementation', 'domain'),
    ('Risk', 'domain')
) as v(name, category)
where not exists (
  select 1
  from public.taxonomy tx
  where tx.workspace_id = tw.id
    and tx.name = v.name
    and coalesce(tx.category, '') = coalesce(v.category, '')
);

with target_workspace as (
  select id from public.workspaces where slug = 'specforge-demo' limit 1
),
first_taxonomy as (
  select id, name from public.taxonomy where workspace_id = (select id from target_workspace)
),
rows_to_insert as (
  select
    tw.id as workspace_id,
    v.title,
    v.body,
    (select ft.id from first_taxonomy ft where ft.name = v.taxonomy_name limit 1) as taxonomy_id,
    v.tags::text[] as tags,
    v.metadata::jsonb as metadata
  from target_workspace tw
  cross join (
    values
      (
        'Statement of Objectives',
        'This document captures the objectives for {{client_name}} and aligns delivery with {{target_outcome}}.',
        'Commercial',
        '{delivery}',
        '{"variants": {"basic": "Objectives for {{client_name}} supporting {{target_outcome}}.", "standard": "This document captures the objectives for {{client_name}} and aligns delivery with {{target_outcome}}.", "robust": "This document captures strategic and operational objectives for {{client_name}}, aligns execution to {{target_outcome}}, and defines measurable success criteria."}}'
      ),
      (
        'Scope Clarification',
        'In-scope items: {{scope_in}}. Out-of-scope items: {{scope_out}}.',
        'Implementation',
        '{compliance,delivery}',
        '{"variants": {"basic": "Scope in: {{scope_in}}. Scope out: {{scope_out}}.", "standard": "In-scope items: {{scope_in}}. Out-of-scope items: {{scope_out}}.", "robust": "The implementation scope includes {{scope_in}} and explicitly excludes {{scope_out}}, with dependencies and assumptions to be validated during planning."}}'
      ),
      (
        'Risk and Mitigation',
        'Known risks include {{risk_summary}}. Planned mitigations: {{mitigation_plan}}.',
        'Risk',
        '{security,compliance}',
        '{"variants": {"basic": "Risks: {{risk_summary}}. Mitigation: {{mitigation_plan}}.", "standard": "Known risks include {{risk_summary}}. Planned mitigations: {{mitigation_plan}}.", "robust": "Known risks include {{risk_summary}} with mitigations defined as {{mitigation_plan}}, plus owners, escalation thresholds, and review cadence."}}'
      )
  ) as v(title, body, taxonomy_name, tags, metadata)
)
insert into public.clause_library (workspace_id, taxonomy_id, title, body, tags, metadata)
select workspace_id, taxonomy_id, title, body, tags, metadata
from rows_to_insert r
where not exists (
  select 1
  from public.clause_library cl
  where cl.workspace_id = r.workspace_id
    and cl.title = r.title
);

with target_workspace as (
  select id from public.workspaces where slug = 'specforge-demo' limit 1
)
insert into public.documents (workspace_id, project_name, title, structure, variable_values)
select
  tw.id,
  'Demo Project',
  'Client Specification Draft',
  jsonb_build_object(
    'sections',
    jsonb_build_array(
      jsonb_build_object('id', gen_random_uuid(), 'title', 'Overview', 'content', 'Prepared for {{client_name}} to deliver {{target_outcome}}.'),
      jsonb_build_object('id', gen_random_uuid(), 'title', 'Scope', 'content', 'Scope includes {{scope_in}} and excludes {{scope_out}}.')
    )
  ),
  '{"client_name":"Acme Corp","target_outcome":"faster onboarding"}'::jsonb
from target_workspace tw
where not exists (
  select 1 from public.documents d where d.workspace_id = tw.id and d.title = 'Client Specification Draft'
);
