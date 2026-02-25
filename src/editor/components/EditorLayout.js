import { renderInspector } from './Inspector';
import { renderPreviewRenderer } from './PreviewRenderer';
import { renderTOC } from './TOC';

export function renderEditorLayout({
  document,
  sections,
  filteredSections,
  activeSectionId,
  selectedBlock,
  saveStateLabel,
  inspectorOpen,
  taxonomy,
  clauses,
  leftSearch,
  allVariables
}) {
  return `
    <section class="editor-layout editor-layout-3pane">
      <aside class="panel toc-panel">
        ${renderTOC({ sections: filteredSections, activeSectionId, taxonomy, clauses, leftSearch })}
      </aside>

      <section class="panel preview-panel">
        ${renderPreviewRenderer({ document, sections, selectedBlock })}
      </section>

      <aside class="panel inspector-panel ${inspectorOpen ? 'open' : ''}">
        ${renderInspector({ document, selectedBlock, saveStateLabel, allVariables })}
      </aside>
    </section>
  `;
}
