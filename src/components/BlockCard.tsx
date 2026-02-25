import { memo } from 'react';
import { getBlockRawBody } from '../editor/model';
import { renderTokenPreview } from './tokenPreview';

type BlockCardProps = {
  block: any;
  clauseMap: Map<string, any>;
  variableValues: Record<string, string>;
  selected: boolean;
  onSelect: (blockId: string) => void;
};

function BlockCardComponent({ block, clauseMap, variableValues, selected, onSelect }: BlockCardProps) {
  const rawBody = getBlockRawBody(block, clauseMap);

  return (
    <div
      className={`preview-block-item ${selected ? 'selected' : ''} ${block.include === false ? 'excluded' : ''}`}
      onClick={() => onSelect(String(block.id))}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect(String(block.id));
        }
      }}
    >
      <div className="preview-block-meta">{block.type === 'clause_ref' ? `Clause reference · ${block.level}` : 'Text block'}</div>
      <pre>{renderTokenPreview(rawBody, variableValues)}</pre>
    </div>
  );
}

const BlockCard = memo(BlockCardComponent);

export default BlockCard;
