import '../style.css';
import { hasSupabaseConfig, supabase } from './supabaseClient';
import { createDocument, getDocument, loadWorkspaceContext, saveDocument } from './api';
import { createStore } from './state';
import {
  createClauseRefBlock,
  createTextBlock,
  extractVariablesFromDocument,
  normalizeDocumentStructure
} from './editor/model';
import { renderClausePickerModal, renderEditorLayout, renderVariableInputs } from './editor/components';

const app = document.querySelector('#app');

const initialState = {
  session: null,
  loading: false,
  authMode: 'signin',
  authError: '',
  contextError: '',
  contextLoading: false,
  saveState: '',
  workspaces: [],
  workspaceMembers: [],
  documents: [],
  clauses: [],
  tags: [],
  taxonomy: [],
  modules: [],
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
    leftSearch: '',
    leftTab: 'document',
    modalOpen: false,
    autosaveTimer: null,
    dirty: false,
    observer: null,
    renderTimer: null,
    saveInFlight: null,
    pendingSave: false,
    lastSavedFingerprint: '',
    isSaving: false,
    saveError: ''
  }
};

const state = createStore(initialState).getState();


const DEBUG_EDITOR = import.meta.env.VITE_EDITOR_DEBUG === 'true';

function logDebug(...args) {
  if (DEBUG_EDITOR) {
    console.debug('[spec-writer]', ...args);
  }
}

function getDocumentFingerprint(document) {
  if (!document) {
    return '';
  }
  return JSON.stringify({
    title: document.title || '',
    project_name: document.project_name || '',
    structure: document.structure || {},
    variable_values: document.variable_values || {}
  });
}

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

function scheduleAutosave() {
  window.clearTimeout(state.editor.autosaveTimer);
  state.editor.autosaveTimer = window.setTimeout(() => {
    void saveEditorDocument();
  }, 900);
}

function getStableElementIdentifier(element) {
  if (!element) {
    return null;
  }
  if (element.id) {
    return { type: 'id', value: element.id };
  }

  const dataAttrs = ['variableKey', 'sectionRename', 'editSectionTitle', 'scrollSection', 'blockId', 'leftTab'];
  for (const key of dataAttrs) {
    if (element.dataset?.[key]) {
      return { type: `data-${key}`, value: element.dataset[key] };
    }
  }

  return null;
}

function captureFocusState() {
  const active = document.activeElement;
  const identifier = getStableElementIdentifier(active);
  if (!identifier) {
    return null;
  }
  return {
    identifier,
    selectionStart: typeof active.selectionStart === 'number' ? active.selectionStart : null,
    selectionEnd: typeof active.selectionEnd === 'number' ? active.selectionEnd : null
  };
}

function resolveElementByIdentifier(identifier) {
  if (!identifier) {
    return null;
  }
  if (identifier.type === 'id') {
    return document.getElementById(identifier.value);
  }

  const dataKey = identifier.type.replace('data-', '');
  const dataAttr = dataKey.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
  return document.querySelector(`[data-${dataAttr}="${CSS.escape(identifier.value)}"]`);
}

function restoreFocusState(focusState) {
  if (!focusState) {
    return;
  }
  const nextElement = resolveElementByIdentifier(focusState.identifier);
  if (!nextElement) {
    return;
  }
  nextElement.focus({ preventScroll: true });
  if (typeof focusState.selectionStart === 'number' && typeof nextElement.setSelectionRange === 'function') {
    nextElement.setSelectionRange(focusState.selectionStart, focusState.selectionEnd ?? focusState.selectionStart);
  }
}

function renderEditorPreservingFocus() {
  const focusState = captureFocusState();
  render();
  restoreFocusState(focusState);
}

function scheduleEditorRender(delay = 120) {
  window.clearTimeout(state.editor.renderTimer);
  state.editor.renderTimer = window.setTimeout(() => {
    renderEditorPreservingFocus();
  }, delay);
}

function markEditorDirty() {
  if (!state.editor.document) {
    return;
  }
  const fingerprint = getDocumentFingerprint(state.editor.document);
  if (fingerprint === state.editor.lastSavedFingerprint) {
    state.editor.dirty = false;
    state.saveState = state.saveState.startsWith('Failed to save:') ? state.saveState : `Saved at ${new Date().toLocaleTimeString()}`;
    return;
  }

  state.editor.dirty = true;
  state.saveState = 'Unsaved changes';
  scheduleAutosave();
}

async function saveEditorDocument() {
  if (!state.editor.document) {
    return;
  }

  const currentFingerprint = getDocumentFingerprint(state.editor.document);
  if (!state.editor.dirty || currentFingerprint === state.editor.lastSavedFingerprint) {
    state.editor.dirty = false;
    state.editor.saveError = '';
    state.saveState = `Saved at ${new Date().toLocaleTimeString()}`;
    return;
  }

  if (state.editor.saveInFlight) {
    state.editor.pendingSave = true;
    logDebug('Save already in flight, queued next save');
    return state.editor.saveInFlight;
  }

  state.editor.isSaving = true;
  state.editor.saveError = '';
  state.saveState = 'Saving...';
  renderEditorPreservingFocus();

  state.editor.saveInFlight = (async () => {
    let saveError = null;
    try {
      try {
        logDebug('Saving document', state.editor.document.id);
        const savedDocument = await saveDocument(state.editor.document);
        state.editor.document = savedDocument;
        state.editor.lastSavedFingerprint = getDocumentFingerprint(savedDocument);
        state.editor.dirty = false;
        state.saveState = `Saved at ${new Date().toLocaleTimeString()}`;
        state.editor.saveError = '';
      } catch (error) {
        saveError = error;
        state.saveState = `Failed to save: ${error.message}`;
        state.editor.saveError = error.message;
        logDebug('Save failed', error);
      }

      try {
        await refreshContext({ silent: true });
      } catch (error) {
        state.contextError = `Saved, but failed to refresh context: ${error.message}`;
        logDebug('Refresh after save failed', error);
      }

      state.editor.saveInFlight = null;
      const shouldRunQueued = state.editor.pendingSave;
      state.editor.pendingSave = false;

      if (shouldRunQueued && state.editor.dirty) {
        logDebug('Running queued save');
        return saveEditorDocument();
      }

      if (saveError) {
        throw saveError;
      }
      return state.editor.document;
    } finally {
      state.editor.isSaving = false;
      renderEditorPreservingFocus();
    }
  })();

  return state.editor.saveInFlight;
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
  if (!sectionId || !blockId) {
    return;
  }
  updateSection(sectionId, (section) => ({
    ...section,
    blocks: (section.blocks || []).map((block) => (block.id === blockId ? mutator(block) : block))
  }));
}

function setActiveSectionByIndex(index) {
  const sections = getEditorSections();
  const bounded = Math.max(0, Math.min(index, sections.length - 1));
  const nextSection = sections[bounded];
  state.editor.activeSectionId = nextSection?.id || '';
  state.editor.selectedBlockSectionId = nextSection?.id || '';
  state.editor.selectedBlockId = nextSection?.blocks?.[0]?.id || '';
}

function moveSection(sectionId, direction) {
  const sections = getEditorSections();
  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) {
    return;
  }
  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= sections.length) {
    return;
  }

  const [section] = sections.splice(index, 1);
  sections.splice(nextIndex, 0, section);
  setActiveSectionByIndex(nextIndex);
  markEditorDirty();
}

function deleteSection(sectionId) {
  const sections = getEditorSections();
  if (sections.length <= 1) {
    state.saveState = 'Document requires at least one section';
    return;
  }

  const index = sections.findIndex((section) => section.id === sectionId);
  if (index < 0) {
    return;
  }

  sections.splice(index, 1);
  setActiveSectionByIndex(index);
  markEditorDirty();
}

async function refreshContext({ silent = false } = {}) {
  if (!state.session || !supabase) {
    return;
  }

  state.contextLoading = true;
  state.contextError = '';
  if (!silent) {
    render();
  }

  try {
    const data = await loadWorkspaceContext();
    state.workspaceMembers = data.workspaceMembers || [];
    state.workspaces = data.workspaces || [];
    state.documents = data.documents || [];
    state.clauses = data.clauses || [];
    state.tags = data.tags || [];
    state.taxonomy = data.taxonomy || [];
    state.modules = data.modules || [];
    if (!state.selectedWorkspaceId && state.workspaces[0]?.id) {
      state.selectedWorkspaceId = state.workspaces[0].id;
    }
    if (!getProjectsForWorkspace().includes(state.selectedProject)) {
      state.selectedProject = 'all';
    }
  } catch (error) {
    state.contextError = error.message;
    if (silent) {
      state.contextLoading = false;
      throw error;
    }
  }

  state.contextLoading = false;
  if (!silent) {
    render();
  }
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
        <select id="workspace-select" ${state.workspaces.length === 0 ? 'disabled' : ''}>
          ${state.workspaces.length === 0 ? '<option value="">No workspaces available</option>' : ''}
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
        <button type="submit" ${state.selectedWorkspaceId ? '' : 'disabled'}>Create and open editor</button>
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

  const workspaceClauses = (state.clauses || []).filter((clause) => String(clause.workspace_id) === String(document.workspace_id));
  document._workspaceClauses = workspaceClauses;
  const workspaceTaxonomy = (state.taxonomy || []).filter((item) => String(item.workspace_id) === String(document.workspace_id));
  const clauseMap = new Map(workspaceClauses.map((clause) => [String(clause.id), clause]));
  const allVariables = [...new Set(Object.keys(document.variable_values || {}).concat(extractVariablesFromDocument(document, clauseMap)))].sort();

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
        <button id="save-document" ${state.editor.isSaving ? 'disabled' : ''}>${state.editor.isSaving ? 'Saving…' : 'Save now'}</button>
      </div>
    </header>

    ${state.editor.saveError ? `<section class="panel error-panel"><strong>Save failed.</strong><p class="error">${escapeHtml(state.editor.saveError)}</p></section>` : ''}

    ${renderEditorLayout({
      document,
      sections,
      filteredSections,
      activeSectionId: state.editor.activeSectionId,
      selectedBlock,
      saveStateLabel: state.saveState || 'Saved',
      inspectorOpen: Boolean(selectedBlock),
      taxonomy: workspaceTaxonomy,
      clauses: workspaceClauses,
      leftSearch: state.editor.leftSearch,
      activeLeftTab: state.editor.leftTab,
      tocSearch: state.editor.tocSearch,
      allVariables
    })}

    ${renderClausePickerModal({
      open: state.editor.modalOpen,
      clauses: getFilteredClauses(document),
      taxonomy: workspaceTaxonomy,
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
  if (!state.editor.document) {
    return;
  }

  document.querySelector('#save-document')?.addEventListener('click', async () => {
    if (state.editor.isSaving) {
      return;
    }
    state.editor.dirty = true;
    await saveEditorDocument();
  });

  document.querySelectorAll('[data-left-tab]').forEach((button) => {
    button.addEventListener('click', (event) => {
      state.editor.leftTab = event.currentTarget.dataset.leftTab;
      renderEditorPreservingFocus();
    });
  });

  document.querySelector('#add-section')?.addEventListener('click', () => {
    const section = { id: crypto.randomUUID(), title: 'New section', blocks: [createTextBlock('')] };
    state.editor.document.structure.sections.push(section);
    setActiveSectionByIndex(state.editor.document.structure.sections.length - 1);
    markEditorDirty();
    render();
  });

  document.querySelector('#toc-search')?.addEventListener('input', (event) => {
    state.editor.tocSearch = event.target.value;
    scheduleEditorRender();
  });

  document.querySelector('#left-search')?.addEventListener('input', (event) => {
    state.editor.leftSearch = event.target.value;
    scheduleEditorRender();
  });

  document.querySelectorAll('[data-section-rename]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const sectionId = event.currentTarget.dataset.sectionRename;
      updateSection(sectionId, (section) => ({ ...section, title: event.target.value || 'Untitled section' }));
      scheduleEditorRender();
    });
  });

  document.querySelectorAll('[data-section-move-up]').forEach((button) => {
    button.addEventListener('click', (event) => {
      moveSection(event.currentTarget.dataset.sectionMoveUp, 'up');
      render();
    });
  });

  document.querySelectorAll('[data-section-move-down]').forEach((button) => {
    button.addEventListener('click', (event) => {
      moveSection(event.currentTarget.dataset.sectionMoveDown, 'down');
      render();
    });
  });

  document.querySelectorAll('[data-delete-section]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const sectionId = event.currentTarget.dataset.deleteSection;
      const section = getEditorSections().find((item) => item.id === sectionId);
      if (!section) {
        return;
      }
      const confirmed = window.confirm(`Delete section "${section.title || 'Untitled section'}"?`);
      if (!confirmed) {
        return;
      }
      deleteSection(sectionId);
      render();
    });
  });

  document.querySelectorAll('[data-scroll-section]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const sectionId = event.currentTarget.dataset.scrollSection;
      state.editor.activeSectionId = sectionId;
      state.editor.selectedBlockSectionId = sectionId;
      const section = getEditorSections().find((item) => item.id === sectionId);
      if (section && !section.blocks?.some((block) => block.id === state.editor.selectedBlockId)) {
        state.editor.selectedBlockId = section.blocks?.[0]?.id || '';
      }
      const anchor = document.querySelector(`#section-${sectionId}`);
      anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (anchor) {
        anchor.classList.add('flash-highlight');
        window.setTimeout(() => anchor.classList.remove('flash-highlight'), 1200);
      }
      document.querySelectorAll('[data-scroll-section]').forEach((item) => {
        item.classList.toggle('active', item.dataset.scrollSection === sectionId);
      });
    });
  });

  document.querySelectorAll('[data-quick-insert-clause]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const selectedSection = getSelectedSection();
      if (!selectedSection) return;
      const block = createClauseRefBlock(event.currentTarget.dataset.quickInsertClause);
      selectedSection.blocks.push(block);
      state.editor.selectedBlockId = block.id;
      state.editor.selectedBlockSectionId = selectedSection.id;
      markEditorDirty();
      render();
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
    scheduleEditorRender();
  });

  document.querySelector('#inspector-clause-level')?.addEventListener('change', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, level: event.target.value }));
    renderEditorPreservingFocus();
  });

  document.querySelector('#inspector-clause-override')?.addEventListener('input', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({
      ...block,
      overrides: { ...(block.overrides || {}), body: event.target.value }
    }));
    scheduleEditorRender();
  });

  document.querySelector('#inspector-include-toggle')?.addEventListener('change', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, include: event.target.value === 'true' }));
    renderEditorPreservingFocus();
  });

  document.querySelector('#inspector-lock-toggle')?.addEventListener('change', (event) => {
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, locked: event.target.value === 'true' }));
    renderEditorPreservingFocus();
  });

  document.querySelector('#inspector-block-tags')?.addEventListener('input', (event) => {
    const tags = event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean);
    updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, tags }));
    scheduleEditorRender();
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
    scheduleEditorRender();
  });

  document.querySelector('#clause-tag-filter')?.addEventListener('change', (event) => {
    state.editor.selectedTag = event.target.value;
    renderEditorPreservingFocus();
  });

  document.querySelector('#clause-taxonomy-filter')?.addEventListener('change', (event) => {
    state.editor.selectedTaxonomy = event.target.value;
    renderEditorPreservingFocus();
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
      renderEditorPreservingFocus();
    });
  });

  function insertVariableToken(key) {
    if (!key) return;
    const token = `{{${key}}}`;
    const selectedBlock = getSelectedBlock();
    if (!selectedBlock) return;
    if (selectedBlock.type === 'text') {
      updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({ ...block, body: `${block.body || ''} ${token}`.trim() }));
    } else {
      updateBlock(state.editor.selectedBlockSectionId, state.editor.selectedBlockId, (block) => ({
        ...block,
        overrides: { ...(block.overrides || {}), body: `${block.overrides?.body || ''} ${token}`.trim() }
      }));
    }
    if (!state.editor.document.variable_values?.[key]) {
      state.editor.document.variable_values = { ...state.editor.document.variable_values, [key]: '' };
    }
    renderEditorPreservingFocus();
  }

  document.querySelector('#insert-existing-variable')?.addEventListener('click', () => {
    const select = document.querySelector('#inspector-existing-variable');
    insertVariableToken(select?.value || '');
  });

  document.querySelector('#create-variable')?.addEventListener('click', () => {
    const input = document.querySelector('#inspector-new-variable');
    const key = (input?.value || '').trim();
    if (!key) return;
    state.editor.document.variable_values = { ...state.editor.document.variable_values, [key]: state.editor.document.variable_values?.[key] || '' };
    insertVariableToken(key);
  });

  const clauseMap = new Map((state.editor.document?._workspaceClauses || []).map((clause) => [String(clause.id), clause]));
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
        scheduleEditorRender();
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
    try {
      const created = await createDocument({ workspaceId: state.selectedWorkspaceId, projectName: form.projectName.value, title: form.title.value });
      await refreshContext();
      navigate(`/editor/${created.id}`);
    } catch (error) {
      state.contextError = error.message;
      render();
    }
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
    state.editor.leftSearch = '';
    state.editor.leftTab = 'document';
    state.editor.modalOpen = false;
    state.editor.dirty = migrated;
    state.editor.isSaving = false;
    state.editor.saveError = '';
    state.editor.pendingSave = false;
    state.editor.saveInFlight = null;
    state.editor.lastSavedFingerprint = getDocumentFingerprint(document);
    state.saveState = migrated ? 'Unsaved changes (legacy sections converted to blocks)' : `Saved at ${new Date().toLocaleTimeString()}`;
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
      state.workspaceMembers = [];
      state.documents = [];
      state.clauses = [];
      state.tags = [];
      state.taxonomy = [];
      state.modules = [];
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
      void saveEditorDocument();
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
