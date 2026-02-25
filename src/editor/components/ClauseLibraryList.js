import { getBlockRawBody } from '../model';
import { escapeHtml, renderTokens } from './utils';

export function renderClauseLibraryList({ clauses, variableValues }) {
  if (!clauses.length) {
    return '<div class="content-header"><h2>Clause Library</h2></div><p class="muted">No clauses match your filters.</p>';
  }

  return `
    <div class="content-header"><h2>Clause Library</h2></div>
    <div class="clause-list library-clause-list">
      ${clauses.map((clause) => {
        const raw = getBlockRawBody({ type: 'clause_ref', clause_id: clause.id, level: 'standard', overrides: {} }, new Map([[String(clause.id), clause]]));
        return `
          <article>
            <h3>${escapeHtml(clause.title)}</h3>
            <p class="muted">Tags: ${(clause.tags || []).map(escapeHtml).join(', ') || 'none'}</p>
            <p class="token-preview">${renderTokens(raw, variableValues || {})}</p>
            <button data-quick-insert-clause="${clause.id}">Insert into active section</button>
          </article>
        `;
      }).join('')}
    </div>
  `;
}
