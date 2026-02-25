import { escapeHtml } from './utils';

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
