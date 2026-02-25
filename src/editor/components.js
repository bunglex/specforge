import { BLOCK_LEVELS, getBlockRawBody, getRenderedBlockBody } from './model';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderEditorLayout({ document, sections, filteredSections, activeSectionId, selectedBlock, saveStateLabel, inspectorOpen }) {
  return `
    <section class="editor-layout editor-layout-3pane">
      <aside class="panel toc-panel">
        ${renderTOC({ sections: filteredSections, activeSectionId })}
      </aside>

      <section class="panel preview-panel">
        ${renderPreviewRenderer({ document, sections, selectedBlock })}
      </section>

      <aside class="panel inspector-panel ${inspectorOpen ? 'open' : ''}">
        ${renderInspector({ document, selectedBlock, saveStateLabel })}
      </aside>
    </section>
  `;
}

export function renderTOC({ sections, activeSectionId }) {
  return `
    <div class="content-header">
      <h2>Sections</h2>
      <button class="ghost" id="add-section">+ Add section</button>
    </div>
    <input id="toc-search" placeholder="Search sections" />
    <div class="outline-list">
      ${sections.length === 0 ? '<p class="muted">No sections match.</p>' : ''}
      ${sections
        .map((section) => `<button class="outline-item ${activeSectionId === section.id ? 'active' : ''}" data-scroll-section="${section.id}">${escapeHtml(section.title || 'Untitled')}</button>`)
        .join('')}
    </div>
  `;
}

export function renderPreviewRenderer({ document, sections, selectedBlock }) {
  const clauseMap = new Map((document._workspaceClauses || []).map((clause) => [String(clause.id), clause]));
  const values = document.variable_values || {};

  return `
    <div class="content-header">
      <h2>Preview</h2>
      <button class="ghost" id="open-clause-modal">Insert Clause</button>
    </div>
    <div id="preview-scroll-container" class="preview-scroll-container">
      ${sections
        .map((section) => `
          <article id="section-${section.id}" class="preview-section" data-section-anchor="${section.id}">
            <header class="preview-section-header">
              <h3 contenteditable="true" data-edit-section-title="${section.id}">${escapeHtml(section.title)}</h3>
            </header>
            ${(section.blocks || [])
              .map((block) => {
                const isSelected = selectedBlock?.id === block.id;
                const body = escapeHtml(getRenderedBlockBody(block, clauseMap, values));
                const clause = block.type === 'clause_ref' ? clauseMap.get(String(block.clause_id)) : null;
                return `
                  <div class="preview-block-item ${isSelected ? 'selected' : ''}" data-block-id="${block.id}" data-section-id="${section.id}">
                    <div class="preview-block-meta">${block.type === 'clause_ref' ? `Clause · ${escapeHtml(clause?.title || 'Unknown clause')}` : 'Text block'}</div>
                    <pre>${body}</pre>
                  </div>
                `;
              })
              .join('')}
          </article>
        `)
        .join('')}
    </div>
  `;
}

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

export function renderClausePickerModal({ open, clauses, taxonomy, tags, editorFilters }) {
  if (!open) {
    return '';
  }

  return `
    <section class="modal-overlay">
      <div class="modal panel">
        <div class="content-header">
          <h2>Insert Clause</h2>
          <button id="close-clause-modal" class="ghost">Close</button>
        </div>
        <div class="clause-filters">
          <input id="clause-search" value="${escapeHtml(editorFilters.search)}" placeholder="Search clauses" />
          <select id="clause-taxonomy-filter">
            <option value="all">All taxonomy</option>
            ${taxonomy.map((item) => `<option value="${item.id}" ${String(item.id) === String(editorFilters.selectedTaxonomy) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
          </select>
          <select id="clause-tag-filter">
            <option value="all">All tags</option>
            ${tags.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === editorFilters.selectedTag ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
          </select>
        </div>
        <div class="clause-list">
          ${clauses.length === 0 ? '<p class="muted">No clauses found.</p>' : ''}
          ${clauses
            .map((clause) => `
              <article>
                <h3>${escapeHtml(clause.title)}</h3>
                <p class="muted">Tags: ${(clause.tags || []).map(escapeHtml).join(', ') || 'none'}</p>
                <p>${escapeHtml(getBlockRawBody({ type: 'clause_ref', clause_id: clause.id, level: 'standard', overrides: {} }, new Map([[String(clause.id), clause]])))}</p>
                <button data-insert-clause="${clause.id}">Insert</button>
              </article>
            `)
            .join('')}
        </div>
      </div>
    </section>
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
