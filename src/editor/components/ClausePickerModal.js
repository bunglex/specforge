import { getBlockRawBody } from '../model';
import { escapeHtml, renderTokens } from './utils';

export function renderClausePickerModal({ open, clauses, taxonomy, tags, editorFilters, variableValues }) {
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
            .map((clause) => {
              const raw = getBlockRawBody({ type: 'clause_ref', clause_id: clause.id, level: 'standard', overrides: {} }, new Map([[String(clause.id), clause]]));
              return `
                <article>
                  <h3>${escapeHtml(clause.title)}</h3>
                  <p class="muted">Tags: ${(clause.tags || []).map(escapeHtml).join(', ') || 'none'}</p>
                  <p class="token-preview">${renderTokens(raw, variableValues || {})}</p>
                  <button data-insert-clause="${clause.id}">Insert</button>
                </article>
              `;
            })
            .join('')}
        </div>
      </div>
    </section>
  `;
}
