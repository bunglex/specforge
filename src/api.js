import { supabase } from './supabaseClient';

function assertClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
}

function safeArray(data) {
  return Array.isArray(data) ? data : [];
}

function ensureObject(data) {
  return data && typeof data === 'object' ? data : {};
}

function throwIfError(result, fallbackMessage) {
  if (result?.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
}

export async function loadWorkspaceContext() {
  assertClient();

  const [membershipRes, workspacesRes, documentsRes, clausesRes, tagsRes, taxonomyRes, modulesRes] = await Promise.all([
    supabase.from('workspace_members').select('workspace_id, role'),
    supabase.from('workspaces').select('*').order('name', { ascending: true }),
    supabase.from('documents').select('*').order('updated_at', { ascending: false }),
    supabase.from('clause_library').select('*').order('title', { ascending: true }),
    supabase.from('tags').select('*').order('name', { ascending: true }),
    supabase.from('taxonomy').select('*').order('category', { ascending: true }).order('name', { ascending: true }),
    supabase.from('modules').select('*').order('title', { ascending: true })
  ]);

  const firstError = [membershipRes, workspacesRes, documentsRes, clausesRes, tagsRes, taxonomyRes, modulesRes].find((res) => res?.error)?.error;
  if (firstError) {
    throw new Error(firstError.message || 'Failed to load workspace context.');
  }

  return {
    workspaceMembers: safeArray(membershipRes.data),
    workspaces: safeArray(workspacesRes.data),
    documents: safeArray(documentsRes.data).map((doc) => ({
      ...doc,
      structure: ensureObject(doc.structure),
      variable_values: ensureObject(doc.variable_values)
    })),
    clauses: safeArray(clausesRes.data),
    tags: safeArray(tagsRes.data),
    taxonomy: safeArray(taxonomyRes.data),
    modules: safeArray(modulesRes.data)
  };
}

export async function createDocument({ workspaceId, projectName, title }) {
  assertClient();

  if (!workspaceId) {
    throw new Error('Select a workspace before creating a document.');
  }

  const emptyStructure = {
    sections: [
      { id: crypto.randomUUID(), title: 'Introduction', blocks: [{ id: crypto.randomUUID(), type: 'text', body: '', include: true, locked: false, tags: [] }] },
      { id: crypto.randomUUID(), title: 'Scope', blocks: [{ id: crypto.randomUUID(), type: 'text', body: '', include: true, locked: false, tags: [] }] }
    ]
  };

  const result = await supabase
    .from('documents')
    .insert({ workspace_id: workspaceId, project_name: projectName, title, structure: emptyStructure, variable_values: {} })
    .select('*')
    .single();

  throwIfError(result, 'Failed to create document.');
  return result.data;
}

export async function getDocument(documentId) {
  assertClient();
  const result = await supabase.from('documents').select('*').eq('id', documentId).maybeSingle();
  throwIfError(result, 'Failed to load document.');
  if (!result.data) {
    throw new Error('Document not found or no access.');
  }
  return {
    ...result.data,
    structure: ensureObject(result.data.structure),
    variable_values: ensureObject(result.data.variable_values)
  };
}

export async function saveDocument(document) {
  assertClient();
  const payload = {
    title: document.title,
    structure: ensureObject(document.structure),
    variable_values: ensureObject(document.variable_values),
    project_name: document.project_name,
    updated_at: new Date().toISOString()
  };

  const result = await supabase.from('documents').update(payload).eq('id', document.id).select('*').single();
  throwIfError(result, 'Failed to save document.');
  return {
    ...result.data,
    structure: ensureObject(result.data.structure),
    variable_values: ensureObject(result.data.variable_values)
  };
}
