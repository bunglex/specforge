import { getRenderedBlockBody } from '../model';
import { escapeHtml } from './utils';

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
