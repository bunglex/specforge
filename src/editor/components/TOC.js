import { escapeHtml } from './utils';

function renderTaxonomyTree({ taxonomy, clausesByTaxonomy }) {
  if (!taxonomy.length) {
    return '<p class="muted">No taxonomy items yet.</p>';
  }

  return taxonomy
    .map((item) => {
      const clauses = clausesByTaxonomy.get(String(item.id)) || [];
      return `
        <details class="tree-node" open>
          <summary>${escapeHtml(item.name)} <span class="muted">(${clauses.length})</span></summary>
          <div class="tree-children">
            ${clauses
              .slice(0, 5)
              .map((clause) => `<button class="outline-item" data-quick-insert-clause="${clause.id}">${escapeHtml(clause.title)}</button>`)
              .join('')}
            ${clauses.length > 5 ? `<p class="muted">+${clauses.length - 5} more in picker</p>` : ''}
          </div>
        </details>
      `;
    })
    .join('');
}

export function renderTOC({ sections, activeSectionId, taxonomy, clauses, leftSearch }) {
  const search = (leftSearch || '').toLowerCase().trim();
  const filteredClauses = clauses.filter((clause) => (`${clause.title} ${clause.body}`.toLowerCase().includes(search)));
  const clausesByTaxonomy = new Map();

  for (const clause of filteredClauses) {
    const key = String(clause.taxonomy_id || 'uncategorized');
    if (!clausesByTaxonomy.has(key)) {
      clausesByTaxonomy.set(key, []);
    }
    clausesByTaxonomy.get(key).push(clause);
  }

  const uncategorized = clausesByTaxonomy.get('uncategorized') || [];

  return `
    <div class="content-header">
      <h2>Library</h2>
      <button class="ghost" id="add-section">+ Add section</button>
    </div>

    <label class="muted">Search clauses</label>
    <input id="left-search" value="${escapeHtml(leftSearch)}" placeholder="Search taxonomy & clauses" />

    <div class="outline-list">
      <h3>Contents</h3>
      <input id="toc-search" placeholder="Search sections" />
      ${sections.length === 0 ? '<p class="muted">No sections match.</p>' : ''}
      ${sections
        .map((section) => `<button class="outline-item ${activeSectionId === section.id ? 'active' : ''}" data-scroll-section="${section.id}">${escapeHtml(section.title || 'Untitled')}</button>`)
        .join('')}
    </div>

    <div class="outline-list">
      <h3>Taxonomy tree</h3>
      ${renderTaxonomyTree({ taxonomy, clausesByTaxonomy })}
      ${uncategorized.length > 0 ? `<h4>Uncategorized</h4>${uncategorized.map((clause) => `<button class="outline-item" data-quick-insert-clause="${clause.id}">${escapeHtml(clause.title)}</button>`).join('')}` : ''}
    </div>
  `;
}
