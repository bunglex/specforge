import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getBlockRawBody } from '../editor/model';
import { renderTokenPreview } from '../components/tokenPreview';
import { useDocument } from '../hooks/useDocument';

export default function EditorPage({ clauses }: { clauses: any[] }) {
  const { id } = useParams();
  const { document, loading, error, saveState, saveDocumentDebounced } = useDocument(id);

  const clauseMap = useMemo(
    () => new Map((clauses || []).map((clause) => [String(clause.id), clause])),
    [clauses]
  );

  if (loading) return <main className="shell"><section className="panel"><p>Loading editor…</p></section></main>;
  if (error || !document) return <main className="shell"><section className="panel error-panel"><p>{error || 'Document not found'}</p><Link to="/dashboard"><button className="ghost">Back</button></Link></section></main>;

  const sections = document.structure?.sections || [];

  return (
    <main className="shell">
      <header className="topbar panel">
        <div><h1>{document.title}</h1><p>{saveState}</p></div>
        <div className="row">
          <Link to="/dashboard"><button className="ghost">Dashboard</button></Link>
          <button onClick={() => saveDocumentDebounced({ immediate: true })}>Save now</button>
        </div>
      </header>

      <section className="editor-layout-3pane">
        <aside className="panel toc-panel">
          <h2>Sections</h2>
          <div className="section-list">
            {sections.map((section: any) => (
              <div className="section-item" key={section.id}>{section.title}</div>
            ))}
            {sections.length === 0 && <p className="muted">No sections.</p>}
          </div>
        </aside>

        <section className="panel preview-panel">
          <h2>Rendered document</h2>
          <div className="preview-scroll-container">
            {sections.map((section: any) => (
              <article className="preview-section" key={section.id}>
                <div className="preview-section-header"><h3>{section.title}</h3></div>
                {(section.blocks || []).map((block: any) => {
                  const raw = getBlockRawBody(block, clauseMap);
                  return (
                    <div key={block.id} className="preview-block-item">
                      <pre>{renderTokenPreview(raw, document.variable_values || {})}</pre>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </section>

        <aside className="panel inspector-panel">
          <h2>Document metadata</h2>
          <p><strong>Project:</strong> {document.project_name || 'N/A'}</p>
          <p><strong>Sections:</strong> {sections.length}</p>
        </aside>
      </section>
    </main>
  );
}
