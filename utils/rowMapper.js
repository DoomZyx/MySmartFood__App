export function toCamelCase(row) {
  if (!row) return null;
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

export function mapRows(rows) {
  return rows ? rows.map(toCamelCase) : [];
}
