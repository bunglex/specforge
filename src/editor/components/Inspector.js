import { BLOCK_LEVELS } from '../model';
import { escapeHtml } from './utils';

export function renderInspector({ document, selectedBlock, saveStateLabel }) {
  const clauseMap = new Map((document._workspaceClauses || []).map((clause) => [String(clause.id), clause]));
  const selectedClause = selectedBlock?.type === 'clause_ref' ? clauseMap.get(String(selectedBlock.clause_id)) : null;

  return `
    <div class="content-header">
      <h2>Inspector</h2>
      <span class="muted">${escapeHtml(saveStateLabel)}</span>
    </div>
    ${!selectedBlock ? '<p class="muted">Select a block to edit it.</p>' : ''}
    ${selectedBlock?.type === 'text' ? `
      <label>Text body</label>
      <textarea id="inspector-text-body" rows="10">${escapeHtml(selectedBlock.body || '')}</textarea>
    ` : ''}

    ${selectedBlock?.type === 'clause_ref' ? `
      <p><strong>${escapeHtml(selectedClause?.title || 'Unknown clause')}</strong></p>
      <label>Detail level</label>
      <select id="inspector-clause-level">
        ${BLOCK_LEVELS.map((level) => `<option value="${level}" ${selectedBlock.level === level ? 'selected' : ''}>${level}</option>`).join('')}
      </select>
      <label>Override body (optional)</label>
      <textarea id="inspector-clause-override" rows="6">${escapeHtml(selectedBlock.overrides?.body || '')}</textarea>
      <button class="ghost" id="inspector-insert-clause">Replace Clause</button>
    ` : ''}

    ${selectedBlock ? '<h3>Variable values</h3><div id="inspector-variable-list"></div>' : ''}
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
