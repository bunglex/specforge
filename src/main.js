import '../style.css';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import { createDocument, getDocument, loadWorkspaceContext, saveDocument } from './api';

const app = document.querySelector('#app');

const state = {
  session: null,
  loading: false,
  authMode: 'signin',
  authError: '',
  contextError: '',
  contextLoading: false,
  saveState: '',
  workspaces: [],
  documents: [],
  clauses: [],
  tags: [],
  taxonomy: [],
  selectedWorkspaceId: '',
  selectedProject: 'all',
  editor: {
    document: null,
    selectedSectionId: '',
    search: '',
    selectedTag: 'all',
    selectedTaxonomy: 'all',
    modalOpen: false
  }
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function navigate(path) {
  window.history.pushState({}, '', path);
  await handleRouteData();
  render();
}

function getRoute() {
  const editorMatch = window.location.pathname.match(/^\/editor\/([^/]+)$/);
  if (editorMatch) {
    return { name: 'editor', documentId: editorMatch[1] };
  }
  return { name: 'dashboard' };
}

function extractVariablesFromDocument(document) {
  const regex = /{{\s*([a-zA-Z0-9_\-.]+)\s*}}/g;
  const keys = new Set();
  const sections = document?.structure?.sections || [];

  for (const section of sections) {
    const content = section.content || '';
    for (const match of content.matchAll(regex)) {
      keys.add(match[1]);
    }
  }

  return [...keys].sort();
}

function renderWithVariables(content, values) {
  return (content || '').replaceAll(/{{\s*([a-zA-Z0-9_\-.]+)\s*}}/g, (_, key) => values?.[key] || `{{${key}}}`);
}

function getProjectsForWorkspace() {
  const docs = state.documents.filter((doc) => String(doc.workspace_id) === String(state.selectedWorkspaceId));
  return [...new Set(docs.map((doc) => doc.project_name).filter(Boolean))].sort();
}

function getFilteredDocuments() {
  const docs = state.documents.filter((doc) => String(doc.workspace_id) === String(state.selectedWorkspaceId));
  if (state.selectedProject === 'all') {
    return docs;
  }
  return docs.filter((doc) => doc.project_name === state.selectedProject);
}

async function refreshContext() {
  if (!state.session || !supabase) {
    return;
  }

  state.contextLoading = true;
  state.contextError = '';
  render();

  try {
    const data = await loadWorkspaceContext();
    state.workspaces = data.workspaces;
    state.documents = data.documents;
    state.clauses = data.clauses;
    state.tags = data.tags;
    state.taxonomy = data.taxonomy;
    if (!state.selectedWorkspaceId && state.workspaces[0]?.id) {
      state.selectedWorkspaceId = state.workspaces[0].id;
    }
    if (!getProjectsForWorkspace().includes(state.selectedProject)) {
      state.selectedProject = 'all';
    }
  } catch (error) {
    state.contextError = error.message;
  }

  state.contextLoading = false;
  render();
}

function authScreen() {
  const modeLabel = state.authMode === 'signin' ? 'Sign in' : 'Create account';
  const toggleLabel = state.authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in';

  return `
    <main class="shell">
      <header>
        <h1>Spec Writer</h1>
        <p>Sign in to manage reusable clauses and structured documents.</p>
      </header>

      <form id="auth-form" class="panel auth-panel">
        <h2>${modeLabel}</h2>
        <label>Email</label>
        <input type="email" name="email" required placeholder="you@example.com" />
        <label>Password</label>
        <input type="password" name="password" minlength="6" required placeholder="••••••••" />
        ${state.authError ? `<p class="error">${escapeHtml(state.authError)}</p>` : ''}
        <div class="row">
          <button type="submit" ${state.loading ? 'disabled' : ''}>${state.loading ? 'Working…' : modeLabel}</button>
          <button type="button" id="toggle-auth" class="ghost">${toggleLabel}</button>
        </div>
      </form>
    </main>
  `;
}

function dashboardScreen() {
  const projects = getProjectsForWorkspace();
  const filteredDocuments = getFilteredDocuments();

  return `
  <main class="shell">
    <header class="topbar">
      <div>
        <h1>Spec Writer</h1>
        <p>Dashboard · ${escapeHtml(state.session?.user?.email || '')}</p>
      </div>
      <button id="sign-out" class="ghost">Sign out</button>
    </header>

    <section class="panel">
      <h2>Workspace & project</h2>
      ${state.contextError ? `<p class="error">${escapeHtml(state.contextError)}</p>` : ''}
      <div class="builder-controls">
        <label for="workspace-select">Workspace</label>
        <select id="workspace-select">
          ${state.workspaces.map((workspace) => `<option value="${workspace.id}" ${String(workspace.id) === String(state.selectedWorkspaceId) ? 'selected' : ''}>${escapeHtml(workspace.name)}</option>`).join('')}
        </select>

        <label for="project-select">Project</label>
        <select id="project-select">
          <option value="all" ${state.selectedProject === 'all' ? 'selected' : ''}>All projects</option>
          ${projects.map((project) => `<option value="${escapeHtml(project)}" ${state.selectedProject === project ? 'selected' : ''}>${escapeHtml(project)}</option>`).join('')}
        </select>
      </div>
    </section>

    <section class="panel">
      <h2>Create document</h2>
      <form id="create-document-form" class="builder-controls">
        <label for="new-project-name">Project</label>
        <input id="new-project-name" name="projectName" required placeholder="Client rollout" />
        <label for="new-document-title">Document title</label>
        <input id="new-document-title" name="title" required placeholder="Implementation Spec" />
        <span></span>
        <button type="submit">Create and open editor</button>
      </form>
    </section>

    <section class="panel">
      <h2>Documents</h2>
      ${state.contextLoading ? '<p>Loading data…</p>' : ''}
      ${filteredDocuments.length === 0 ? '<p class="muted">No documents found for this selection.</p>' : ''}
      <div class="doc-list">
        ${filteredDocuments.map((doc) => `
          <article>
            <div>
              <strong>${escapeHtml(doc.title)}</strong>
              <p class="muted">${escapeHtml(doc.project_name || 'No project')}</p>
            </div>
            <button data-open-document="${doc.id}">Open editor</button>
          </article>
        `).join('')}
      </div>
    </section>
  </main>
  `;
}

function getSelectedSection() {
  const sections = state.editor.document?.structure?.sections || [];
  return sections.find((section) => section.id === state.editor.selectedSectionId) || sections[0] || null;
}

function editorScreen() {
  const document = state.editor.document;
  if (!document) {
    return `<main class="shell"><section class="panel"><h2>Loading editor…</h2></section></main>`;
  }

  const sections = document.structure?.sections || [];
  const selectedSection = getSelectedSection();
  const variableKeys = extractVariablesFromDocument(document);
  const values = document.variable_values || {};

  const clauses = state.clauses.filter((clause) => {
    if (String(clause.workspace_id) !== String(document.workspace_id)) {
      return false;
    }

    const searchTerm = state.editor.search.toLowerCase().trim();
    const body = `${clause.title} ${clause.body}`.toLowerCase();
    if (searchTerm && !body.includes(searchTerm)) {
      return false;
    }

    if (state.editor.selectedTaxonomy !== 'all' && String(clause.taxonomy_id || '') !== String(state.editor.selectedTaxonomy)) {
      return false;
    }

    if (state.editor.selectedTag !== 'all' && !(clause.tags || []).includes(state.editor.selectedTag)) {
      return false;
    }

    return true;
  });

  return `
  <main class="shell editor-shell">
    <header class="topbar">
      <div>
        <h1>${escapeHtml(document.title)}</h1>
        <p>${escapeHtml(document.project_name || 'No project')}</p>
      </div>
      <div class="row">
        <button id="back-to-dashboard" class="ghost">Dashboard</button>
        <button id="save-document">Save</button>
      </div>
    </header>

    ${state.saveState ? `<p class="${state.saveState.includes('Failed') ? 'error' : 'muted'}">${escapeHtml(state.saveState)}</p>` : ''}

    <section class="editor-layout">
      <aside class="panel outline-panel">
        <h2>Sections</h2>
        <div class="outline-list">
          ${sections.map((section) => `<button class="outline-item ${selectedSection?.id === section.id ? 'active' : ''}" data-section-id="${section.id}">${escapeHtml(section.title || 'Untitled')}</button>`).join('')}
        </div>
        <button id="add-section" class="ghost">+ Add section</button>
      </aside>

      <section class="panel content-panel">
        <div class="content-header">
          <h2>Editor</h2>
          <button id="open-clause-modal" class="ghost">Insert Clause</button>
        </div>

        ${selectedSection ? `
          <label>Section title</label>
          <input id="section-title-input" value="${escapeHtml(selectedSection.title)}" />
          <label>Body</label>
          <textarea id="section-content-input" rows="12">${escapeHtml(selectedSection.content || '')}</textarea>
          <h3>Preview</h3>
          <article class="preview-block">${escapeHtml(renderWithVariables(selectedSection.content, values))}</article>
        ` : '<p class="muted">Add a section to begin.</p>'}
      </section>

      <aside class="panel variables-panel">
        <h2>Variables</h2>
        ${variableKeys.length === 0 ? '<p class="muted">No placeholders detected. Use {{variable_name}} in section content.</p>' : ''}
        ${variableKeys.map((key) => `
          <label class="variable-field">
            <span>${escapeHtml(key)}</span>
            <input data-variable-key="${escapeHtml(key)}" value="${escapeHtml(values[key] || '')}" placeholder="Enter value" />
          </label>
        `).join('')}
      </aside>
    </section>

    ${state.editor.modalOpen ? `
      <section class="modal-overlay">
        <div class="modal panel">
          <div class="content-header">
            <h2>Clause Library</h2>
            <button id="close-clause-modal" class="ghost">Close</button>
          </div>
          <div class="clause-filters">
            <input id="clause-search" value="${escapeHtml(state.editor.search)}" placeholder="Search by title or body" />
            <select id="clause-taxonomy-filter">
              <option value="all">All taxonomy</option>
              ${state.taxonomy
                .filter((item) => String(item.workspace_id) === String(document.workspace_id))
                .map((item) => `<option value="${item.id}" ${String(item.id) === String(state.editor.selectedTaxonomy) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
                .join('')}
            </select>
            <select id="clause-tag-filter">
              <option value="all">All tags</option>
              ${state.tags
                .filter((item) => String(item.workspace_id) === String(document.workspace_id))
                .map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === state.editor.selectedTag ? 'selected' : ''}>${escapeHtml(item.name)}</option>`)
                .join('')}
            </select>
          </div>
          <div class="clause-list">
            ${clauses.length === 0 ? '<p class="muted">No clauses match your filters.</p>' : ''}
            ${clauses.map((clause) => `
              <article>
                <h3>${escapeHtml(clause.title)}</h3>
                <p class="muted">Tags: ${(clause.tags || []).map(escapeHtml).join(', ') || 'none'}</p>
                <p>${escapeHtml(clause.body)}</p>
                <button data-insert-clause="${clause.id}">Insert</button>
              </article>
            `).join('')}
          </div>
        </div>
      </section>
    ` : ''}
  </main>
  `;
}

function render() {
  if (!hasSupabaseConfig()) {
    app.innerHTML = '<main class="shell"><h1>Spec Writer</h1><p class="error">Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.</p></main>';
    return;
  }

  if (!state.session) {
    app.innerHTML = authScreen();
    wireCommonEvents();
    return;
  }

  const route = getRoute();
  app.innerHTML = route.name === 'editor' ? editorScreen() : dashboardScreen();
  wireCommonEvents();
}

function updateSelectedSection(mutator) {
  const sections = state.editor.document?.structure?.sections || [];
  const index = sections.findIndex((section) => section.id === state.editor.selectedSectionId);
  if (index < 0) {
    return;
  }

  sections[index] = mutator(sections[index]);
}

async function loadEditorDocument(documentId) {
  try {
    const document = await getDocument(documentId);
    state.editor.document = document;
    state.editor.selectedSectionId = document.structure?.sections?.[0]?.id || '';
    state.saveState = '';
  } catch (error) {
    state.saveState = `Failed to load document: ${error.message}`;
  }
}

function wireCommonEvents() {
  document.querySelector('#toggle-auth')?.addEventListener('click', () => {
    state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
    state.authError = '';
    render();
  });

  document.querySelector('#auth-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    state.loading = true;
    state.authError = '';
    render();

    const method = state.authMode === 'signup' ? 'signUp' : 'signInWithPassword';
    const { error } = await supabase.auth[method]({ email: form.email.value, password: form.password.value });
    state.loading = false;
    if (error) {
      state.authError = error.message;
      render();
    }
  });

  document.querySelector('#sign-out')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  document.querySelector('#workspace-select')?.addEventListener('change', (event) => {
    state.selectedWorkspaceId = event.target.value;
    state.selectedProject = 'all';
    render();
  });

  document.querySelector('#project-select')?.addEventListener('change', (event) => {
    state.selectedProject = event.target.value;
    render();
  });

  document.querySelector('#create-document-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const created = await createDocument({ workspaceId: state.selectedWorkspaceId, projectName: form.projectName.value, title: form.title.value });
    await refreshContext();
    navigate(`/editor/${created.id}`);
  });

  document.querySelectorAll('[data-open-document]').forEach((button) => {
    button.addEventListener('click', (event) => {
      navigate(`/editor/${event.currentTarget.dataset.openDocument}`);
    });
  });

  document.querySelector('#back-to-dashboard')?.addEventListener('click', () => navigate('/'));

  document.querySelector('#save-document')?.addEventListener('click', async () => {
    if (!state.editor.document) {
      return;
    }
    try {
      state.saveState = 'Saving…';
      render();
      state.editor.document = await saveDocument(state.editor.document);
      state.saveState = `Saved at ${new Date().toLocaleTimeString()}`;
      await refreshContext();
    } catch (error) {
      state.saveState = `Failed to save: ${error.message}`;
    }
    render();
  });

  document.querySelectorAll('[data-section-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      state.editor.selectedSectionId = event.currentTarget.dataset.sectionId;
      render();
    });
  });

  document.querySelector('#add-section')?.addEventListener('click', () => {
    const newSection = { id: crypto.randomUUID(), title: 'New section', content: '' };
    state.editor.document.structure.sections.push(newSection);
    state.editor.selectedSectionId = newSection.id;
    render();
  });

  document.querySelector('#section-title-input')?.addEventListener('input', (event) => {
    updateSelectedSection((section) => ({ ...section, title: event.target.value }));
    render();
  });

  document.querySelector('#section-content-input')?.addEventListener('input', (event) => {
    updateSelectedSection((section) => ({ ...section, content: event.target.value }));
    render();
  });

  document.querySelectorAll('[data-variable-key]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const key = event.target.dataset.variableKey;
      state.editor.document.variable_values = { ...state.editor.document.variable_values, [key]: event.target.value };
      render();
    });
  });

  document.querySelector('#open-clause-modal')?.addEventListener('click', () => {
    state.editor.modalOpen = true;
    render();
  });

  document.querySelector('#close-clause-modal')?.addEventListener('click', () => {
    state.editor.modalOpen = false;
    render();
  });

  document.querySelector('#clause-search')?.addEventListener('input', (event) => {
    state.editor.search = event.target.value;
    render();
  });

  document.querySelector('#clause-tag-filter')?.addEventListener('change', (event) => {
    state.editor.selectedTag = event.target.value;
    render();
  });

  document.querySelector('#clause-taxonomy-filter')?.addEventListener('change', (event) => {
    state.editor.selectedTaxonomy = event.target.value;
    render();
  });

  document.querySelectorAll('[data-insert-clause]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const clause = state.clauses.find((item) => String(item.id) === String(event.currentTarget.dataset.insertClause));
      if (!clause) {
        return;
      }

      updateSelectedSection((section) => ({
        ...section,
        content: `${section.content || ''}${section.content ? '\n\n' : ''}${clause.body}`
      }));
      state.editor.modalOpen = false;
      render();
    });
  });
}

async function init() {
  render();

  const { data } = await supabase.auth.getSession();
  state.session = data.session;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    state.session = session;
    if (!session) {
      state.workspaces = [];
      state.documents = [];
      state.clauses = [];
      state.tags = [];
      state.taxonomy = [];
      state.editor.document = null;
      navigate('/');
      return;
    }

    await refreshContext();
    await handleRouteData();
    render();
  });

  window.addEventListener('popstate', async () => {
    await handleRouteData();
    render();
  });

  if (state.session) {
    await refreshContext();
    await handleRouteData();
  }

  render();
}

async function handleRouteData() {
  const route = getRoute();
  if (route.name !== 'editor') {
    state.editor.document = null;
    return;
  }

  if (!state.editor.document || state.editor.document.id !== route.documentId) {
    await loadEditorDocument(route.documentId);
  }
}

init();
