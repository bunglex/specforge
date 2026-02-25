import { supabase } from './supabaseClient';

function assertClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }
}

export async function loadWorkspaceContext() {
  assertClient();

  const [workspacesRes, documentsRes, clausesRes, tagsRes, taxonomyRes] = await Promise.all([
    supabase.from('workspaces').select('*').order('name', { ascending: true }),
    supabase.from('documents').select('*').order('updated_at', { ascending: false }),
    supabase.from('clause_library').select('*').order('title', { ascending: true }),
    supabase.from('tags').select('*').order('name', { ascending: true }),
    supabase.from('taxonomy').select('*').order('name', { ascending: true })
  ]);

  const error = workspacesRes.error || documentsRes.error || clausesRes.error || tagsRes.error || taxonomyRes.error;
  if (error) {
    throw error;
  }

  return {
    workspaces: workspacesRes.data || [],
    documents: documentsRes.data || [],
    clauses: clausesRes.data || [],
    tags: tagsRes.data || [],
    taxonomy: taxonomyRes.data || []
  };
}

export async function createDocument({ workspaceId, projectName, title }) {
  assertClient();

  const emptyStructure = {
    sections: [
      { id: crypto.randomUUID(), title: 'Introduction', content: '' },
      { id: crypto.randomUUID(), title: 'Scope', content: '' }
    ]
  };

  const { data, error } = await supabase
    .from('documents')
    .insert({ workspace_id: workspaceId, project_name: projectName, title, structure: emptyStructure, variable_values: {} })
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getDocument(documentId) {
  assertClient();
  const { data, error } = await supabase.from('documents').select('*').eq('id', documentId).single();
  if (error) {
    throw error;
  }
  return data;
}

export async function saveDocument(document) {
  assertClient();
  const payload = {
    title: document.title,
    structure: document.structure,
    variable_values: document.variable_values,
    project_name: document.project_name,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('documents').update(payload).eq('id', document.id).select('*').single();
  if (error) {
    throw error;
  }
  return data;
}
