export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderTokens(text, variableValues = {}) {
  const source = String(text ?? '');
  const regex = /\{\{\s*([a-zA-Z0-9_\-.]+)\s*\}\}/g;
  let cursor = 0;
  let html = '';

  for (const match of source.matchAll(regex)) {
    const index = match.index ?? 0;
    html += escapeHtml(source.slice(cursor, index));
    const key = match[1];
    const value = variableValues?.[key];
    if (value === undefined || value === null || value === '') {
      html += `<span class="var-token missing">(missing:${escapeHtml(key)})</span>`;
    } else {
      html += `<span class="var-token">${escapeHtml(String(value))}</span>`;
    }
    cursor = index + match[0].length;
  }

  html += escapeHtml(source.slice(cursor));
  return html.replaceAll('\n', '<br/>');
}
