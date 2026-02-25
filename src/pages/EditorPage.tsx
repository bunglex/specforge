import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDocument, saveDocument } from '../api';
import { extractVariablesFromDocument, getBlockRawBody, normalizeDocumentStructure } from '../editor/model';
import { useEditorStore } from '../store/editorStore';
import { renderTokenPreview } from '../components/tokenPreview';
import type { Clause } from '../types';

function TextBlockEditor({ sectionId, blockId, value, selected, onSelect }: { sectionId: string; blockId: string; value: string; selected: boolean; onSelect: () => void; }) {
  const updateBlockText = useEditorStore((state) => state.updateBlockText);
  const [draft, setDraft] = useState(value || '');
  const timerRef = useRef<number | null>(null);

  useEffect(() => setDraft(value || ''), [blockId, value]);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  const commit = (nextValue: string) => updateBlockText(sectionId, blockId, nextValue);

  return (
    <div className={`preview-block-item ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <textarea
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => commit(next), 240);
        }}
        onBlur={() => {
          if (timerRef.current) window.clearTimeout(timerRef.current);
          commit(draft);
        }}
      />
    </div>
  );
}

export default function EditorPage({ clauses, onBack, onContextRefresh }: { session: any; clauses: Clause[]; onBack: () => void; onContextRefresh: () => Promise<void>; }) {
  const { documentId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [leftTab, setLeftTab] = useState<'document' | 'library'>('document');

  const { document, selectedSectionId, selectedBlockId, setDocument, setSelectedBlock, dirty, markSaving, markSaved, markSaveError, saveStatus, lastSavedAt, isSaving } = useEditorStore();

  const saveNow = async () => {
    if (!document) return;
    markSaving();
    try {
      const saved = await saveDocument(document);
      setDocument(saved, clauses || []);
      markSaved();
      await onContextRefresh();
    } catch (saveError: any) {
      markSaveError(saveError.message);
    }
  };

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError('');
      try {
        const raw = await getDocument(String(documentId));
        const normalized = normalizeDocumentStructure(raw).document;
        if (!mounted) return;
        setDocument(normalized, clauses || []);
      } catch (loadError: any) {
        if (mounted) setError(loadError.message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [documentId, clauses, setDocument]);

  useEffect(() => {
    if (!dirty || !document) return;
    const timer = window.setTimeout(() => { void saveNow(); }, 900);
    return () => window.clearTimeout(timer);
  }, [dirty, document]);

  const sections = document?.structure?.sections || [];
  const clauseMap = useMemo(() => new Map((clauses || []).map((clause) => [String(clause.id), clause])), [clauses]);
  const selectedSection = sections.find((section) => section.id === selectedSectionId) || sections[0];
  const selectedBlock = selectedSection?.blocks?.find((block) => block.id === selectedBlockId) || selectedSection?.blocks?.[0];

  const variableKeys = useMemo(() => {
    if (!document) return [];
    return extractVariablesFromDocument(document, clauseMap);
  }, [document, clauseMap]);

  const saveLabel = saveStatus === 'saving'
    ? 'Saving...'
    : saveStatus === 'dirty'
      ? 'Unsaved changes'
      : saveStatus === 'error'
        ? 'Save failed'
        : lastSavedAt
          ? `Saved at ${lastSavedAt}`
          : 'Saved';

  if (loading) return <main className="shell"><section className="panel"><p>Loading editor…</p></section></main>;
  if (error || !document) return <main className="shell"><section className="panel error-panel"><p>{error || 'Document not found'}</p><button onClick={onBack}>Back</button></section></main>;

  return (
    <main className="shell">
      <header className="topbar panel">
        <div><h1>{document.title}</h1><p>{saveLabel}</p></div>
        <div className="row"><button className="ghost" onClick={onBack}>Dashboard</button><button onClick={() => void saveNow()} disabled={isSaving}>Save now</button></div>
      </header>

      <section className="editor-layout-3pane">
        <aside className="panel toc-panel">
          <div className="left-tabs">
            <button className={leftTab === 'document' ? 'active' : ''} onClick={() => setLeftTab('document')}>Document</button>
            <button className={leftTab === 'library' ? 'active' : ''} onClick={() => setLeftTab('library')}>Library</button>
          </div>
          {leftTab === 'document' ? (
            <div className="section-list">
              {sections.map((section) => (
                <button className={`outline-item ${section.id === selectedSection?.id ? 'active' : ''}`} key={section.id} onClick={() => setSelectedBlock(section.id, section.blocks?.[0]?.id || '')}>{section.title}</button>
              ))}
            </div>
          ) : (
            <div className="clause-list library-clause-list">{clauses.map((clause) => <article key={clause.id}><strong>{clause.title}</strong></article>)}</div>
          )}
        </aside>

        <section className="panel preview-panel">
          <div className="content-header"><h2>Canvas</h2></div>
          <div className="preview-scroll-container">
            {sections.map((section) => (
              <article className="preview-section" key={section.id}>
                <div className="preview-section-header"><h3>{section.title}</h3></div>
                {section.blocks.map((block) => {
                  const raw = getBlockRawBody(block, clauseMap);
                  const isSelected = selectedBlock?.id === block.id;
                  if (block.type === 'text') {
                    return <TextBlockEditor key={block.id} sectionId={section.id} blockId={block.id} value={block.body || ''} selected={isSelected} onSelect={() => setSelectedBlock(section.id, block.id)} />;
                  }
                  return (
                    <div key={block.id} className={`preview-block-item ${isSelected ? 'selected' : ''}`} onClick={() => setSelectedBlock(section.id, block.id)}>
                      <pre>{renderTokenPreview(raw, document.variable_values || {})}</pre>
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </section>

        <aside className="panel inspector-panel">
          <h2>Inspector</h2>
          {!selectedBlock ? <p className="muted">Select a block.</p> : (
            <>
              <p className="muted">Type: {selectedBlock.type}</p>
              <div>
                <h3>Rendered preview</h3>
                <pre className="token-preview">{renderTokenPreview(getBlockRawBody(selectedBlock, clauseMap), document.variable_values || {})}</pre>
              </div>
            </>
          )}
          <div>
            <h3>Variables</h3>
            <div className="outline-list">
              {variableKeys.map((key) => (
                <label className="variable-field" key={key}>
                  <span>{key}</span>
                  <input value={document.variable_values?.[key] || ''} onChange={(event) => useEditorStore.getState().updateVariableValue(key, event.target.value)} />
                </label>
              ))}
              {variableKeys.length === 0 && <p className="muted">No variables found.</p>}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
