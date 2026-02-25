import { renderClauseLibraryList } from './ClauseLibraryList';
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
  tags,
  libraryClauses,
  leftSearch,
  activeLeftTab,
  tocSearch,
  selectedTaxonomy,
  selectedTag,
  allVariables
}) {
  return `
    <section class="editor-layout editor-layout-3pane">
      <aside class="panel toc-panel">
        ${renderTOC({
          sections: filteredSections,
          activeSectionId,
          taxonomy,
          tags,
          leftSearch,
          activeLeftTab,
          tocSearch,
          selectedTaxonomy,
          selectedTag
        })}
      </aside>

      <section class="panel preview-panel">
        ${activeLeftTab === 'library'
          ? renderClauseLibraryList({ clauses: libraryClauses, variableValues: document?.variable_values || {} })
          : renderPreviewRenderer({ document, sections, selectedBlock })}
      </section>

      <aside class="panel inspector-panel ${inspectorOpen ? 'open' : ''}">
        ${renderInspector({ document, selectedBlock, saveStateLabel, allVariables })}
      </aside>
    </section>
  `;
}
