import './style.css';
import { createClient } from '@supabase/supabase-js';

const app = document.querySelector('#app');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getSupabaseConfigError(url, anonKey) {
  if (!url || !anonKey) {
    return 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.';
  }

  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith('.supabase.co')) {
      return 'VITE_SUPABASE_URL must point to your Supabase project domain (https://<project-ref>.supabase.co).';
    }
  } catch {
    return 'VITE_SUPABASE_URL is not a valid URL.';
  }

  return '';
}

const supabaseConfigError = getSupabaseConfigError(supabaseUrl, supabaseAnonKey);
const supabase = !supabaseConfigError ? createClient(supabaseUrl, supabaseAnonKey) : null;

let seededDataLoadVersion = 0;
const unavailableTables = new Set();
const TABLE_LOAD_TIMEOUT_MS = 10000;

function mapAuthError(error) {
  if (!error) {
    return '';
  }

  if (error.message === 'Failed to fetch') {
    return `Unable to reach Supabase at ${supabaseUrl}. Double-check VITE_SUPABASE_URL and your network/DNS.`;
  }

  return error.message;
}

function withTimeout(promise, timeoutMs, onTimeoutMessage) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(onTimeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

const state = {
  session: null,
  loading: false,
  dataLoading: false,
  authMode: 'signin',
  authError: '',
  dataError: '',
  dataWarning: '',
  dataHint: '',
  dataGuidance: '',
  workspaces: [],
  modules: [],
  tags: [],
  taxonomy: [],
  selectedWorkspaceId: '',
  selectedModuleId: '',
  variableValues: {}
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseVariablesSchema(schema) {
  if (!schema) {
    return [];
  }

  if (typeof schema === 'string') {
    try {
      return parseVariablesSchema(JSON.parse(schema));
    } catch {
      return [];
    }
  }

  if (Array.isArray(schema)) {
    return schema
      .map((item, index) => {
        const key = item?.key || item?.name || `field_${index + 1}`;
        return {
          key,
          label: item?.label || key,
          type: item?.type || 'text',
          placeholder: item?.placeholder || '',
          required: Boolean(item?.required)
        };
      })
      .filter((item) => item.key);
  }

  if (typeof schema === 'object') {
    const fields = schema.fields || schema.properties || schema;
    return Object.entries(fields).map(([key, item]) => ({
      key,
      label: item?.label || item?.title || key,
      type: item?.type === 'number' ? 'number' : item?.type === 'textarea' ? 'textarea' : 'text',
      placeholder: item?.placeholder || '',
      required: Boolean(item?.required)
    }));
  }

  return [];
}

function getFilteredModules() {
  if (!state.selectedWorkspaceId) {
    return state.modules;
  }

  return state.modules.filter((module) => {
    const workspaceField = module.workspace_id ?? module.workspaceId ?? module.workspace;
    return String(workspaceField ?? '') === String(state.selectedWorkspaceId);
  });
}

function getSelectedModule() {
  const modules = getFilteredModules();
  return modules.find((module) => String(module.id) === String(state.selectedModuleId)) || null;
}

function setDefaultSelections() {
  if (!state.selectedWorkspaceId && state.workspaces[0]?.id) {
    state.selectedWorkspaceId = String(state.workspaces[0].id);
  }

  const filteredModules = getFilteredModules();
  if (!filteredModules.some((module) => String(module.id) === String(state.selectedModuleId))) {
    state.selectedModuleId = filteredModules[0]?.id ? String(filteredModules[0].id) : '';
    state.variableValues = {};
  }
}

async function loadSeededData() {
  if (!supabase || !state.session) {
    return;
  }

  const loadVersion = ++seededDataLoadVersion;

  state.dataLoading = true;
  state.dataError = '';
  state.dataWarning = '';
  state.dataHint = '';
  state.dataGuidance = '';
  render();

  try {
    const tableNames = ['workspaces', 'modules', 'tags', 'taxonomy'];
    const tableSettledResults = await Promise.allSettled(
      tableNames.map((table) => withTimeout(
        fetchTableData(table),
        TABLE_LOAD_TIMEOUT_MS,
        `Timed out loading ${table} after ${TABLE_LOAD_TIMEOUT_MS}ms.`
      ))
    );

    if (loadVersion !== seededDataLoadVersion) {
      return;
    }

    const tableResults = tableSettledResults.map((result, index) => {
      const table = tableNames[index];

      if (result.status === 'fulfilled') {
        return result.value;
      }

      return {
        table,
        data: [],
        error: {
          message: result.reason?.message || `Failed to query ${table}.`
        }
      };
    });

    const [workspacesRes, modulesRes, tagsRes, taxonomyRes] = tableResults;

    state.workspaces = workspacesRes.data || [];
    state.modules = modulesRes.data || [];
    state.tags = tagsRes.data || [];
    state.taxonomy = taxonomyRes.data || [];

    const tableResults = [workspacesRes, modulesRes, tagsRes, taxonomyRes];

    const missingTables = tableResults
      .filter((result) => isMissingTableError(result.error))
      .map((result) => result.table);

    const nonMissingTableErrors = tableResults
      .filter((result) => result.error && !isMissingTableError(result.error))
      .map((result) => `${result.table}: ${result.error.message}`);

    state.dataError = nonMissingTableErrors.join(' · ');
    state.dataWarning = missingTables.length
      ? `Optional table(s) not found and skipped: ${missingTables.join(', ')}.`
      : '';

    const totalRows = state.workspaces.length + state.modules.length + state.tags.length + state.taxonomy.length;
    if (!state.dataError && totalRows === 0) {
      state.dataHint = 'No rows are visible for this user.';
      state.dataGuidance = getDataGuidance(tableResults);
    }

    if (state.dataError) {
      state.dataGuidance = getDataGuidance(tableResults);
    }

    setDefaultSelections();
  } catch (error) {
    if (loadVersion !== seededDataLoadVersion) {
      return;
    }

    state.workspaces = [];
    state.modules = [];
    state.tags = [];
    state.taxonomy = [];
    state.dataError = mapAuthError(error) || 'Failed to load seeded data.';
  } finally {
    if (loadVersion === seededDataLoadVersion) {
      state.dataLoading = false;
      render();
    }
  }
}

async function fetchTableData(table) {
  if (unavailableTables.has(table)) {
    return {
      table,
      data: [],
      error: {
        code: 'PGRST205',
        status: 404,
        message: `Skipping ${table} because it was previously reported as missing.`
      }
    };
  }

  let data;
  let error;

  try {
    const preferredQuery = supabase.from(table).select('*').order('name', { ascending: true }).limit(200);
    ({ data, error } = await preferredQuery);
  } catch (queryError) {
    return {
      table,
      data: [],
      error: {
        message: queryError?.message || `Failed to query ${table}.`
      }
    };
  }

  if (error?.code === '42703') {
    try {
      const fallbackQuery = supabase.from(table).select('*').limit(200);
      ({ data, error } = await fallbackQuery);
    } catch (queryError) {
      return {
        table,
        data: [],
        error: {
          message: queryError?.message || `Failed to query ${table}.`
        }
      };
    }
  }

  if (isMissingTableError(error)) {
    unavailableTables.add(table);
  }

  return { table, data: data || [], error };
}

function isMissingTableError(error) {
  return error?.code === '42P01' || error?.code === 'PGRST205' || error?.status === 404;
}

function getDataGuidance(tableResults = []) {
  if (state.dataLoading) {
    return '';
  }

  const blockedTables = tableResults.filter((result) => {
    const status = result.error?.status;
    return status === 401 || status === 403 || status === 500;
  });

  if (blockedTables.length > 0) {
    const tableList = blockedTables.map((result) => result.table).join(', ');
    const userEmail = state.session?.user?.email || 'current user';
    const userId = state.session?.user?.id || '<auth-user-id>';

    return `Access looks blocked for ${tableList}. For ${userEmail}, confirm seeded membership rows exist and match auth.users.id=${userId}, then verify SELECT RLS policies permit this user.`;
  }

  const totalRows = state.workspaces.length + state.modules.length + state.tags.length + state.taxonomy.length;
  if (totalRows > 0) {
    return '';
  }

  if (state.workspaces.length === 0) {
    return 'A 404 is usually unrelated to workspace membership. In this app it most often means an optional table (often taxonomy) does not exist. If workspaces are still 0, verify the logged-in user has a workspace membership row allowed by your workspaces SELECT policy.';
    return 'The 404 is typically unrelated to workspace membership. In this app it usually means an optional table (often taxonomy) does not exist. If workspaces are still 0, verify kjones@hotmail.com has a workspace membership row allowed by your workspaces SELECT policy.';
  }

  return 'If your project has seeded rows but this user sees none, your RLS policies likely require membership records. Yes: you usually need to assign the user to a workspace (or relax SELECT policies).';
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabase) {
    return;
  }

  const form = event.currentTarget;
  const email = form.email.value;
  const password = form.password.value;

  state.loading = true;
  state.authError = '';
  render();

  const method = state.authMode === 'signup' ? 'signUp' : 'signInWithPassword';

  try {
    const { error } = await supabase.auth[method]({ email, password });

    if (error) {
      state.authError = mapAuthError(error);
    }
  } catch (error) {
    state.authError = mapAuthError(error);
  }

  state.loading = false;
  render();
}

async function handleSignOut() {
  if (!supabase) {
    return;
  }

  state.loading = true;
  state.authError = '';
  render();

  try {
    const signOutPromise = supabase.auth.signOut();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Sign out request timed out.')), 8000);
    });

    const { error } = await Promise.race([signOutPromise, timeoutPromise]);
    if (error) {
      throw error;
    }
  } catch (error) {
    state.authError = `${mapAuthError(error) || 'Sign out failed.'} Clearing local session.`;
    await supabase.auth.signOut({ scope: 'local' });
  }

  state.loading = false;
  render();
}

function wireEvents() {
  document.querySelector('#auth-form')?.addEventListener('submit', handleAuthSubmit);

  document.querySelector('#toggle-auth')?.addEventListener('click', () => {
    state.authMode = state.authMode === 'signin' ? 'signup' : 'signin';
    state.authError = '';
    render();
  });

  document.querySelector('#sign-out')?.addEventListener('click', handleSignOut);

  document.querySelector('#reload-seeded-data')?.addEventListener('click', () => {
    loadSeededData();
  });

  document.querySelector('#workspace-select')?.addEventListener('change', (event) => {
    state.selectedWorkspaceId = event.target.value;
    setDefaultSelections();
    render();
  });

  document.querySelector('#module-select')?.addEventListener('change', (event) => {
    state.selectedModuleId = event.target.value;
    state.variableValues = {};
    render();
  });

  document.querySelectorAll('[data-variable-key]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const key = event.target.dataset.variableKey;
      state.variableValues[key] = event.target.value;
    });
  });
}

function render() {
  if (!supabase) {
    app.innerHTML = `
      <main class="shell">
        <h1>SpecForge MVP</h1>
        <p class="error">${escapeHtml(supabaseConfigError)}</p>
      </main>
    `;
    return;
  }

  if (!state.session) {
    const modeLabel = state.authMode === 'signin' ? 'Sign in' : 'Create account';
    const toggleLabel = state.authMode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in';

    app.innerHTML = `
      <main class="shell">
        <header>
          <h1>SpecForge MVP</h1>
          <p>Authenticate with Supabase to load seeded workspaces, modules, tags, and taxonomy.</p>
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

    wireEvents();
    return;
  }

  const filteredModules = getFilteredModules();
  const selectedModule = getSelectedModule();
  const variableFields = parseVariablesSchema(selectedModule?.variables_schema);

  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <div>
          <h1>SpecForge MVP</h1>
          <p>Connected to Supabase as ${escapeHtml(state.session.user.email || 'user')}.</p>
          ${state.authError ? `<p class="error">${escapeHtml(state.authError)}</p>` : ''}
        </div>
        <button id="sign-out" class="ghost" ${state.loading ? 'disabled' : ''}>Sign out</button>
      </header>

      <section class="panel data-overview">
        <div class="data-overview-header">
          <h2>Seeded data</h2>
          <button id="reload-seeded-data" class="ghost" ${state.dataLoading ? 'disabled' : ''}>${state.dataLoading ? 'Loading…' : 'Reload data'}</button>
        </div>
        ${state.dataLoading ? '<p>Loading from Supabase…</p>' : ''}
        ${state.dataError ? `<p class="error">${escapeHtml(state.dataError)}</p>` : ''}
        ${state.dataWarning ? `<p class="muted">${escapeHtml(state.dataWarning)}</p>` : ''}
        ${state.dataHint ? `<p class="muted">${escapeHtml(state.dataHint)}</p>` : ''}
        ${state.dataGuidance ? `<p class="guidance">${escapeHtml(state.dataGuidance)}</p>` : ''}
        <div class="stats">
          <article><span>Workspaces</span><strong>${state.workspaces.length}</strong></article>
          <article><span>Modules</span><strong>${state.modules.length}</strong></article>
          <article><span>Tags</span><strong>${state.tags.length}</strong></article>
          <article><span>Taxonomy</span><strong>${state.taxonomy.length}</strong></article>
        </div>
      </section>

      <section class="panel builder">
        <h2>Builder</h2>
        <div class="builder-controls">
          <label for="workspace-select">Workspace</label>
          <select id="workspace-select">
            <option value="">All workspaces</option>
            ${state.workspaces
              .map((workspace) => `<option value="${escapeHtml(workspace.id)}" ${String(workspace.id) === String(state.selectedWorkspaceId) ? 'selected' : ''}>${escapeHtml(workspace.name || workspace.slug || workspace.id)}</option>`)
              .join('')}
          </select>

          <label for="module-select">Module</label>
          <select id="module-select" ${filteredModules.length === 0 ? 'disabled' : ''}>
            ${filteredModules
              .map((module) => `<option value="${escapeHtml(module.id)}" ${String(module.id) === String(state.selectedModuleId) ? 'selected' : ''}>${escapeHtml(module.name || module.title || module.id)}</option>`)
              .join('')}
          </select>
        </div>

        ${selectedModule ? `
          <div class="module-card">
            <h3>${escapeHtml(selectedModule.name || selectedModule.title || 'Selected module')}</h3>
            <p class="muted">Module ID: ${escapeHtml(selectedModule.id)}</p>
            <div class="override-preview">
              <h4>override_html</h4>
              <div class="html-render">${selectedModule.override_html || '<em>No override_html provided.</em>'}</div>
            </div>

            <div>
              <h4>variables_schema inputs</h4>
              ${variableFields.length === 0 ? '<p class="muted">No variables_schema fields found.</p>' : ''}
              <div class="variable-grid">
                ${variableFields
                  .map((field) => {
                    const inputType = field.type === 'number' ? 'number' : 'text';
                    const value = state.variableValues[field.key] || '';
                    return `
                      <label class="variable-field">
                        <span>${escapeHtml(field.label)}</span>
                        ${field.type === 'textarea'
                          ? `<textarea data-variable-key="${escapeHtml(field.key)}" placeholder="${escapeHtml(field.placeholder)}">${escapeHtml(value)}</textarea>`
                          : `<input type="${inputType}" data-variable-key="${escapeHtml(field.key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.placeholder)}" ${field.required ? 'required' : ''} />`}
                      </label>
                    `;
                  })
                  .join('')}
              </div>
            </div>
          </div>
        ` : '<p class="muted">No modules available for this workspace.</p>'}
      </section>
    </main>
  `;

  wireEvents();
}

async function init() {
  render();

  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.getSession();
  state.session = data.session;

  supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;

    if (!session) {
      state.workspaces = [];
      state.modules = [];
      state.tags = [];
      state.taxonomy = [];
      state.selectedWorkspaceId = '';
      state.selectedModuleId = '';
      state.variableValues = {};
      state.dataHint = '';
      state.dataWarning = '';
      state.dataGuidance = '';
      unavailableTables.clear();
      render();
      return;
    }

    loadSeededData();
  });

  if (state.session) {
    await loadSeededData();
  }

  render();
}

init();
