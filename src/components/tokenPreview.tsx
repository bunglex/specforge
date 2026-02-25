import React from 'react';

const TOKEN_REGEX = /\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g;

export function renderTokenPreview(text: string, variableValues: Record<string, string>) {
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let keyIndex = 0;

  for (const match of text.matchAll(TOKEN_REGEX)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }
    const tokenKey = match[1];
    const value = variableValues?.[tokenKey];
    if (value === undefined || value === null || value === '') {
      parts.push(
        <span key={`missing-${tokenKey}-${keyIndex++}`} className="var-token missing">
          (missing:{tokenKey})
        </span>
      );
    } else {
      parts.push(
        <span key={`token-${tokenKey}-${keyIndex++}`} className="var-token">
          {String(value)}
        </span>
      );
    }
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }

  return parts;
}
