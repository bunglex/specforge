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

function renderDocumentTab({ sections, activeSectionId, tocSearch }) {
  return `
    <div class="content-header">
      <h2>Document</h2>
      <button class="ghost" id="add-section">+ Add section</button>
    </div>

    <label class="muted">Search sections</label>
    <input id="toc-search" value="${escapeHtml(tocSearch)}" placeholder="Search contents" />

    <div class="outline-list section-list">
      ${sections.length === 0 ? '<p class="muted">No sections match.</p>' : ''}
      ${sections
        .map((section, index) => `
          <div class="section-item ${activeSectionId === section.id ? 'active' : ''}">
            <button class="outline-item" data-scroll-section="${section.id}">${index + 1}. ${escapeHtml(section.title || 'Untitled')}</button>
            <input data-section-rename="${section.id}" value="${escapeHtml(section.title || '')}" aria-label="Rename ${escapeHtml(section.title || 'section')}" />
            <div class="row">
              <button class="ghost" data-section-move-up="${section.id}" ${index === 0 ? 'disabled' : ''}>↑</button>
              <button class="ghost" data-section-move-down="${section.id}" ${index === sections.length - 1 ? 'disabled' : ''}>↓</button>
              <button class="ghost" data-delete-section="${section.id}">Delete</button>
            </div>
          </div>
        `)
        .join('')}
    </div>
  `;
}

function renderLibraryTab({ leftSearch, taxonomy, clauses }) {
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
    <h2>Library</h2>
    <label class="muted">Search clauses</label>
    <input id="left-search" value="${escapeHtml(leftSearch)}" placeholder="Search taxonomy & clauses" />

    <div class="outline-list">
      <h3>Taxonomy tree</h3>
      ${renderTaxonomyTree({ taxonomy, clausesByTaxonomy })}
      ${uncategorized.length > 0 ? `<h4>Uncategorized</h4>${uncategorized.map((clause) => `<button class="outline-item" data-quick-insert-clause="${clause.id}">${escapeHtml(clause.title)}</button>`).join('')}` : ''}
    </div>
  `;
}

export function renderTOC({
  sections,
  activeSectionId,
  taxonomy,
  clauses,
  leftSearch,
  activeLeftTab,
  tocSearch
}) {
  return `
    <div class="left-tabs" role="tablist" aria-label="Navigation tabs">
      <button class="ghost ${activeLeftTab === 'document' ? 'active' : ''}" data-left-tab="document">Document</button>
      <button class="ghost ${activeLeftTab === 'library' ? 'active' : ''}" data-left-tab="library">Library</button>
    </div>

    ${activeLeftTab === 'document'
    ? renderDocumentTab({ sections, activeSectionId, tocSearch })
    : renderLibraryTab({ leftSearch, taxonomy, clauses })}
  `;
}
