import { escapeHtml } from './utils';

function renderTaxonomyTree({ taxonomy }) {
  if (!taxonomy.length) {
    return '<p class="muted">No taxonomy items yet.</p>';
  }

  return taxonomy
    .map((item) => `
      <details class="tree-node" open>
        <summary>${escapeHtml(item.name)}</summary>
      </details>
    `)
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

function renderLibraryTab({ leftSearch, taxonomy, tags, selectedTaxonomy, selectedTag }) {
  return `
    <h2>Library</h2>
    <label class="muted">Search clauses</label>
    <input id="left-search" value="${escapeHtml(leftSearch)}" placeholder="Search by title/body" />

    <label class="muted">Taxonomy</label>
    <select id="left-taxonomy-filter">
      <option value="all">All taxonomy</option>
      ${taxonomy.map((item) => `<option value="${item.id}" ${String(item.id) === String(selectedTaxonomy) ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
    </select>

    <label class="muted">Tag</label>
    <select id="left-tag-filter">
      <option value="all">All tags</option>
      ${tags.map((item) => `<option value="${escapeHtml(item.name)}" ${item.name === selectedTag ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
    </select>

    <div class="outline-list">
      <h3>Taxonomy tree</h3>
      ${renderTaxonomyTree({ taxonomy })}
    </div>
  `;
}

export function renderTOC({
  sections,
  activeSectionId,
  taxonomy,
  tags,
  leftSearch,
  activeLeftTab,
  tocSearch,
  selectedTaxonomy,
  selectedTag
}) {
  return `
    <div class="left-tabs" role="tablist" aria-label="Navigation tabs">
      <button class="ghost ${activeLeftTab === 'document' ? 'active' : ''}" data-left-tab="document">Document</button>
      <button class="ghost ${activeLeftTab === 'library' ? 'active' : ''}" data-left-tab="library">Library</button>
    </div>

    ${activeLeftTab === 'document'
    ? renderDocumentTab({ sections, activeSectionId, tocSearch })
    : renderLibraryTab({ leftSearch, taxonomy, tags, selectedTaxonomy, selectedTag })}
  `;
}
