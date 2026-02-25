import { BLOCK_LEVELS } from '../model';
import { escapeHtml } from './utils';

export function renderInspector({ document, selectedBlock, saveStateLabel, allVariables }) {
  const clauseMap = new Map(((document?._workspaceClauses) || []).map((clause) => [String(clause.id), clause]));
  const selectedClause = selectedBlock?.type === 'clause_ref' ? clauseMap.get(String(selectedBlock.clause_id)) : null;
  const values = document?.variable_values || {};

  return `
    <div class="content-header">
      <h2>Inspector</h2>
      <span class="muted">${escapeHtml(saveStateLabel)}</span>
    </div>
    ${!selectedBlock ? '<p class="muted">Select a block to edit it.</p>' : ''}

    ${selectedBlock ? `
      <label>Include in output</label>
      <select id="inspector-include-toggle">
        <option value="true" ${selectedBlock.include !== false ? 'selected' : ''}>Included</option>
        <option value="false" ${selectedBlock.include === false ? 'selected' : ''}>Excluded</option>
      </select>
      <label>Edit lock</label>
      <select id="inspector-lock-toggle">
        <option value="false" ${selectedBlock.locked ? '' : 'selected'}>Unlocked</option>
        <option value="true" ${selectedBlock.locked ? 'selected' : ''}>Locked</option>
      </select>
      <label>Tags (comma separated)</label>
      <input id="inspector-block-tags" value="${escapeHtml((selectedBlock.tags || []).join(', '))}" placeholder="security, legal" />
    ` : ''}

    ${selectedBlock?.type === 'text' ? `
      <label>Text body</label>
      <textarea id="inspector-text-body" rows="10">${escapeHtml(selectedBlock.body || '')}</textarea>
    ` : ''}

    ${selectedBlock?.type === 'clause_ref' ? `
      <p><strong>${escapeHtml(selectedClause?.title || 'Unknown clause')}</strong></p>
      <label>Version</label>
      <select id="inspector-clause-level">
        ${BLOCK_LEVELS.map((level) => `<option value="${level}" ${selectedBlock.level === level ? 'selected' : ''}>${escapeHtml(level[0].toUpperCase() + level.slice(1))}</option>`).join('')}
      </select>
      <label>Override body (optional)</label>
      <textarea id="inspector-clause-override" rows="6">${escapeHtml(selectedBlock.overrides?.body || '')}</textarea>
      <button class="ghost" id="inspector-insert-clause">Replace Clause</button>
    ` : ''}

    ${selectedBlock ? `
      <h3>Variables</h3>
      <label>Insert existing variable</label>
      <div class="row">
        <select id="inspector-existing-variable">
          <option value="">Select variable</option>
          ${allVariables.map((key) => `<option value="${escapeHtml(key)}">${escapeHtml(key)}</option>`).join('')}
        </select>
        <button class="ghost" id="insert-existing-variable">Insert token</button>
      </div>
      <label>Create variable</label>
      <div class="row">
        <input id="inspector-new-variable" placeholder="new_variable_name" />
        <button class="ghost" id="create-variable">Create & insert</button>
      </div>
      <div id="inspector-variable-list">
        ${Object.keys(values).length === 0 ? '<p class="muted">No values yet.</p>' : ''}
      </div>
    ` : ''}
  `;
}

export function renderVariableInputs(container, variables, values) {
  container.innerHTML = variables
    .map((key) => `
      <label class="variable-field">
        <span>${escapeHtml(key)}</span>
        <input data-variable-key="${escapeHtml(key)}" value="${escapeHtml(values[key] || '')}" placeholder="Enter value" />
      </label>
    `)
    .join('');
}
