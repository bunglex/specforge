import { memo } from 'react';
import BlockCard from './BlockCard';

type CanvasProps = {
  sections: any[];
  clauseMap: Map<string, any>;
  variableValues: Record<string, string>;
  selectedBlockId: string;
  onSelectBlock: (blockId: string) => void;
  compact?: boolean;
};

function CanvasComponent({ sections, clauseMap, variableValues, selectedBlockId, onSelectBlock, compact = false }: CanvasProps) {
  return (
    <section className={`panel preview-panel${compact ? ' preview-panel-compact' : ''}`}>
      {!compact ? <h2>Rendered document</h2> : null}
      <div className="preview-scroll-container">
        {sections.map((section) => (
          <article className="preview-section" key={section.id}>
            <div className="preview-section-header">
              <h3>{section.title}</h3>
            </div>
            {(section.blocks || []).map((block: any) => (
              <BlockCard
                key={block.id}
                block={block}
                clauseMap={clauseMap}
                variableValues={variableValues}
                selected={selectedBlockId === String(block.id)}
                onSelect={onSelectBlock}
              />
            ))}
          </article>
        ))}
        {sections.length === 0 ? <p className="muted">No sections.</p> : null}
      </div>
    </section>
  );
}

const Canvas = memo(CanvasComponent);

export default Canvas;
