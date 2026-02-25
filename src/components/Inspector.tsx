import { BLOCK_LEVELS, extractVariablesFromDocument } from '../editor/model';

type InspectorProps = {
  document: any;
  selectedBlock: any;
  clauseMap: Map<string, any>;
  onSelectedBodyChange: (body: string) => void;
  onSelectedLevelChange: (level: string) => void;
  onOpenClausePicker: () => void;
};

export default function Inspector({
  document,
  selectedBlock,
  clauseMap,
  onSelectedBodyChange,
  onSelectedLevelChange,
  onOpenClausePicker
}: InspectorProps) {
  const variableKeys = extractVariablesFromDocument(document, clauseMap);

  return (
    <aside className="panel inspector-panel">
      <h2>Inspector</h2>
      {!selectedBlock ? <p className="muted">Select a block to edit.</p> : null}
      {selectedBlock ? (
        <>
          <p><strong>Type:</strong> {selectedBlock.type}</p>
          {selectedBlock.type === 'clause_ref' ? (
            <>
              <label>Clause level</label>
              <select value={selectedBlock.level || 'standard'} onChange={(event) => onSelectedLevelChange(event.target.value)}>
                {BLOCK_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
              </select>
              <button className="ghost" onClick={onOpenClausePicker}>Pick clause</button>
              <label>Override body</label>
              <textarea
                rows={12}
                value={selectedBlock?.overrides?.body || ''}
                onChange={(event) => onSelectedBodyChange(event.target.value)}
              />
            </>
          ) : (
            <>
              <label>Body</label>
              <textarea
                rows={14}
                value={selectedBlock.body || ''}
                onChange={(event) => onSelectedBodyChange(event.target.value)}
              />
            </>
          )}
        </>
      ) : null}
      <h3>Variables in document</h3>
      <div className="section-list">
        {variableKeys.map((key) => (
          <div className="section-item" key={key}>{key}</div>
        ))}
        {variableKeys.length === 0 ? <p className="muted">No variables detected.</p> : null}
      </div>
    </aside>
  );
}
