import '../style.css';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import { createDocument, getDocument, loadWorkspaceContext, saveDocument } from './api';
import {
  createClauseRefBlock,
  createTextBlock,
  extractVariablesFromDocument,
  normalizeDocumentStructure
} from './editor/model';
import { renderClausePickerModal, renderEditorLayout, renderVariableInputs } from './editor/components';

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
    activeSectionId: '',
    selectedBlockId: '',
    selectedBlockSectionId: '',
    tocSearch: '',
    search: '',
    selectedTag: 'all',
    selectedTaxonomy: 'all',
    modalOpen: false,
    autosaveTimer: null,
    dirty: false,
    observer: null
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

function getEditorSections() {
  return state.editor.document?.structure?.sections || [];
}

function getSelectedSection() {
  return getEditorSections().find((section) => section.id === state.editor.activeSectionId) || getEditorSections()[0] || null;
}

function getSelectedBlock() {
  const section = getEditorSections().find((item) => item.id === state.editor.selectedBlockSectionId);
  return section?.blocks?.find((block) => block.id === state.editor.selectedBlockId) || null;
}

function markEditorDirty() {
  state.editor.dirty = true;
  state.saveState = 'Unsaved changes';
  window.clearTimeout(state.editor.autosaveTimer);
  state.editor.autosaveTimer = window.setTimeout(() => {
    saveEditorDocument();
  }, 900);
}

async function saveEditorDocument() {
  if (!state.editor.document || !state.editor.dirty) {
    return;
  }
  try {
    state.saveState = 'Saving…';
    render();
    state.editor.document = await saveDocument(state.editor.document);
    state.editor.dirty = false;
    state.saveState = `Saved at ${new Date().toLocaleTimeString()}`;
    await refreshContext();
  } catch (error) {
    state.saveState = `Failed to save: ${error.message}`;
  }
  render();
}

function updateSection(sectionId, mutator) {
  const sections = getEditorSections();
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) {
    return;
  }
  sections[index] = mutator(sections[index]);
  markEditorDirty();
}

function updateBlock(sectionId, blockId, mutator) {
  updateSection(sectionId, (section) => ({
    ...section,
    blocks: (section.blocks || []).map((block) => (block.id === blockId ? mutator(block) : block))
  }));
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

function getFilteredClauses(document) {
  return state.clauses.filter((clause) => {
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
}

function editorScreen() {
  const document = state.editor.document;
  if (!document) {
    return `<main class="shell"><section class="panel"><h2>Loading editor…</h2></section></main>`;
  }

  const sections = getEditorSections();
  const selectedBlock = getSelectedBlock();
  const filteredSections = sections.filter((section) =>
    (section.title || '').toLowerCase().includes(state.editor.tocSearch.toLowerCase().trim())
  );

  document._workspaceClauses = state.clauses.filter((clause) => String(clause.workspace_id) === String(document.workspace_id));

  return `
  <main class="shell editor-shell">
    <header class="topbar">
      <div>
        <h1>${escapeHtml(document.title)}</h1>
        <p>${escapeHtml(document.project_name || 'No project')}</p>
      </div>
      <div class="row">
        <span class="muted">${escapeHtml(state.saveState || 'Saved')}</span>
        <button id="back-to-dashboard" class="ghost">Dashboard</button>
        <button id="save-document">Save now</button>
      </div>
    </header>

    ${renderEditorLayout({
      document,
      sections,
      filteredSections,
      activeSectionId: state.editor.activeSectionId,
      selectedBlock,
      saveStateLabel: state.saveState || 'Saved',
      inspectorOpen: Boolean(selectedBlock)
    })}

    ${renderClausePickerModal({
      open: state.editor.modalOpen,
      clauses: getFilteredClauses(document),
      taxonomy: state.taxonomy.filter((item) => String(item.workspace_id) === String(document.workspace_id)),
      tags: state.tags.filter((item) => String(item.workspace_id) === String(document.workspace_id)),
      editorFilters: state.editor
    })}
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

function setupIntersectionObserver() {
  if (state.editor.observer) {
    state.editor.observer.disconnect();
  }
  const scrollContainer = document.querySelector('#preview-scroll-container');
  if (!scrollContainer) {
    return;
  }

  const targets = [...document.querySelectorAll('[data-section-anchor]')];
  state.editor.observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible?.target?.dataset?.sectionAnchor) {
        state.editor.activeSectionId = visible.target.dataset.sectionAnchor;
        document.querySelectorAll('[data-scroll-section]').forEach((button) => {
          button.classList.toggle('active', button.dataset.scrollSection === state.editor.activeSectionId);
        });
      }
    },
    { root: scrollContainer, threshold: [0.2, 0.5, 0.8] }
  );

  targets.forEach((target) => state.editor.observer.observe(target));
}

function wireEditorSpecificEvents() {
  document.querySelector('#save-document')?.addEventListener('click', async () => {
    state.editor.dirty = true;
    await saveEditorDocument();
  });

  document.querySelector('#add-section')?.addEventListener('click', () => {
    const section = { id: crypto.randomUUID(), title: 'New section', blocks: [createTextBlock('')] };
    state.editor.document.structure.sections.push(section);
    state.editor.activeSectionId = section.id;
    state.editor.selectedBlockId = section.blocks[0].id;
    state.editor.selectedBlockSectionId = section.id;
    markEditorDirty();
    render();
  });

  document.querySelector('#toc-search')?.addEventListener('input', (event) => {
    state.editor.tocSearch = event.target.value;
    render();
  });

  document.querySelectorAll('[data-scroll-section]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const sectionId = event.currentTarget.dataset.scrollSection;
      state.editor.activeSectionId = sectionId;
      const anchor = document.querySelector(`#section-${sectionId}`);
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('[data-scroll-section]').forEach((item) => {
        item.classList.toggle('active', item.dataset.scrollSection === sectionId);
      });
    });
  });

  document.querySelectorAll('[data-block-id]').forEach((node) => {
    node.addEventListener('click', (event) => {
      const blockId = event.currentTarget.dataset.blockId;
      const sectionId = event.currentTarget.dataset.sectionId;
      state.editor.selectedBlockId = blockId;
      state.editor.selectedBlockSectionId = sectionId;
      render();
    });
  });

  document.querySelector('#inspector-text-body')?.addEventListener('input', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, body: event.target.value }));
    render();
  });

  document.querySelector('#inspector-clause-level')?.addEventListener('change', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, level: event.target.value }));
    render();
  });

  document.querySelector('#inspector-clause-override')?.addEventListener('input', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({
      ...block,
      overrides: { ...(block.overrides || {}), body: event.target.value }
    }));
    render();
  });

  document.querySelectorAll('[data-edit-section-title]').forEach((heading) => {
    heading.addEventListener('blur', (event) => {
      const sectionId = event.currentTarget.dataset.editSectionTitle;
      updateSection(sectionId, (section) => ({ ...section, title: event.currentTarget.textContent || 'Untitled section' }));
      render();
    });
  });

  document.querySelector('#open-clause-modal')?.addEventListener('click', () => {
    state.editor.modalOpen = true;
    render();
  });

  document.querySelector('#inspector-insert-clause')?.addEventListener('click', () => {
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
      const selectedSection = getSelectedSection();
      if (!selectedSection) {
        return;
      }
      const block = createClauseRefBlock(event.currentTarget.dataset.insertClause);
      selectedSection.blocks.push(block);
      state.editor.selectedBlockId = block.id;
      state.editor.selectedBlockSectionId = selectedSection.id;
      state.editor.modalOpen = false;
      markEditorDirty();
      render();
    });
  });

  const clauseMap = new Map((state.editor.document._workspaceClauses || []).map((clause) => [String(clause.id), clause]));
  const selectedBlock = getSelectedBlock();
  const variables = selectedBlock ? [...extractVariablesFromDocument({ structure: { sections: [{ blocks: [selectedBlock] }] } }, clauseMap)] : [];
  const variableContainer = document.querySelector('#inspector-variable-list');
  if (variableContainer) {
    renderVariableInputs(variableContainer, variables, state.editor.document.variable_values || {});
    variableContainer.querySelectorAll('[data-variable-key]').forEach((input) => {
      input.addEventListener('input', (event) => {
        const key = event.target.dataset.variableKey;
        state.editor.document.variable_values = { ...state.editor.document.variable_values, [key]: event.target.value };
        markEditorDirty();
      });
    });
  }

  setupIntersectionObserver();
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

  if (getRoute().name === 'editor') {
    wireEditorSpecificEvents();
  }
}

async function loadEditorDocument(documentId) {
  try {
    const sourceDocument = await getDocument(documentId);
    const { document, migrated } = normalizeDocumentStructure(sourceDocument);
    state.editor.document = document;
    state.editor.activeSectionId = document.structure?.sections?.[0]?.id || '';
    state.editor.selectedBlockSectionId = document.structure?.sections?.[0]?.id || '';
    state.editor.selectedBlockId = document.structure?.sections?.[0]?.blocks?.[0]?.id || '';
    state.editor.tocSearch = '';
    state.editor.modalOpen = false;
    state.editor.dirty = migrated;
    state.saveState = migrated ? 'Unsaved changes (legacy sections converted to blocks)' : 'Saved';
    if (migrated) {
      await saveEditorDocument();
    }
  } catch (error) {
    state.saveState = `Failed to load document: ${error.message}`;
  }
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

  window.addEventListener('keydown', (event) => {
    if (getRoute().name !== 'editor') {
      return;
    }

    if (event.key === 'Escape') {
      state.editor.selectedBlockId = '';
      state.editor.selectedBlockSectionId = '';
      render();
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      state.editor.dirty = true;
      saveEditorDocument();
    }
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
