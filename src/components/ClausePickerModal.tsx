import { useMemo, useState } from 'react';

type ClausePickerModalProps = {
  clauses: any[];
  open: boolean;
  onClose: () => void;
  onPickClause: (clauseId: string) => void;
};

export default function ClausePickerModal({ clauses, open, onClose, onPickClause }: ClausePickerModalProps) {
  const [query, setQuery] = useState('');

  const filteredClauses = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clauses;
    return clauses.filter((clause) => {
      const title = String(clause.title || '').toLowerCase();
      const body = String(clause.body || '').toLowerCase();
      return title.includes(q) || body.includes(q);
    });
  }, [clauses, query]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <section className="panel modal" onClick={(event) => event.stopPropagation()}>
        <div className="content-header">
          <h2>Clause picker</h2>
          <button className="ghost" onClick={onClose}>Close</button>
        </div>
        <input
          placeholder="Search clauses"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="clause-list library-clause-list">
          {filteredClauses.map((clause) => (
            <article key={clause.id}>
              <strong>{clause.title}</strong>
              <p className="muted">{clause.category || 'Uncategorized'}</p>
              <pre className="token-preview">{String(clause.body || '').slice(0, 220)}</pre>
              <div className="row">
                <button onClick={() => onPickClause(String(clause.id))}>Use clause</button>
              </div>
            </article>
          ))}
          {filteredClauses.length === 0 ? <p className="muted">No matching clauses.</p> : null}
        </div>
      </section>
    </div>
  );
}
