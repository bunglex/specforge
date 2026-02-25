export const BLOCK_LEVELS = ['outline', 'standard', 'detailed'];

export function normalizeDocumentStructure(document) {
  const sections = Array.isArray(document?.structure?.sections) ? document.structure.sections : [];
  let migrated = false;

  const normalizedSections = sections.map((section) => {
    const safeSection = section || {};
    let blocks = [];

    if (Array.isArray(safeSection.blocks)) {
      blocks = safeSection.blocks.map(normalizeBlock).filter(Boolean);
    } else if (typeof safeSection.content === 'string') {
      migrated = true;
      blocks = [{ id: crypto.randomUUID(), type: 'text', body: safeSection.content }];
    } else {
      blocks = [{ id: crypto.randomUUID(), type: 'text', body: '' }];
      migrated = true;
    }

    return {
      id: safeSection.id || crypto.randomUUID(),
      title: safeSection.title || 'Untitled section',
      blocks
    };
  });

  return {
    document: {
      ...document,
      structure: { sections: normalizedSections },
      variable_values: document?.variable_values || {}
    },
    migrated
  };
}

export function normalizeBlock(block) {
  if (!block || !block.type) {
    return null;
  }

  if (block.type === 'text') {
    return {
      id: block.id || crypto.randomUUID(),
      type: 'text',
      body: typeof block.body === 'string' ? block.body : ''
    };
  }

  if (block.type === 'clause_ref') {
    return {
      id: block.id || crypto.randomUUID(),
      type: 'clause_ref',
      clause_id: block.clause_id || '',
      level: BLOCK_LEVELS.includes(block.level) ? block.level : 'standard',
      overrides: {
        body: block?.overrides?.body || ''
      }
    };
  }

  return null;
}

export function createTextBlock(body = '') {
  return { id: crypto.randomUUID(), type: 'text', body };
}

export function createClauseRefBlock(clauseId, level = 'standard') {
  return { id: crypto.randomUUID(), type: 'clause_ref', clause_id: clauseId, level, overrides: {} };
}

export function getClauseBodyForLevel(clause, level) {
  if (!clause) {
    return '';
  }
  const metadata = clause.metadata || {};
  if (typeof metadata?.variants?.[level] === 'string') {
    return metadata.variants[level];
  }
  if (typeof metadata?.[`${level}_body`] === 'string') {
    return metadata[`${level}_body`];
  }
  return clause.body || '';
}

export function getBlockRawBody(block, clauseMap) {
  if (!block) {
    return '';
  }
  if (block.type === 'text') {
    return block.body || '';
  }
  if (block.type === 'clause_ref') {
    const overrideBody = block?.overrides?.body;
    if (overrideBody) {
      return overrideBody;
    }
    return getClauseBodyForLevel(clauseMap.get(block.clause_id), block.level);
  }
  return '';
}

export function renderWithVariables(content, values) {
  return (content || '').replaceAll(/{{\s*([a-zA-Z0-9_\-.]+)\s*}}/g, (_, key) => values?.[key] || `{{${key}}}`);
}

export function getRenderedBlockBody(block, clauseMap, values) {
  return renderWithVariables(getBlockRawBody(block, clauseMap), values);
}

export function extractVariablesFromText(content) {
  const regex = /{{\s*([a-zA-Z0-9_\-.]+)\s*}}/g;
  const keys = new Set();
  for (const match of (content || '').matchAll(regex)) {
    keys.add(match[1]);
  }
  return keys;
}

export function extractVariablesFromDocument(document, clauseMap) {
  const keys = new Set();
  const sections = document?.structure?.sections || [];
  for (const section of sections) {
    for (const block of section.blocks || []) {
      const blockKeys = extractVariablesFromText(getBlockRawBody(block, clauseMap));
      for (const key of blockKeys) {
        keys.add(key);
      }
    }
  }
  return [...keys].sort();
}
