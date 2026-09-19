export function documentsToWebsite(records = []) {
  if (!Array.isArray(records)) return [];
  return records
    .filter((item) => item?.kind && !item.purgedAt)
    .map((item) => ({
      kind: item.kind,
      mimeType: item.mimeType || null,
      byteSize: Number(item.byteSize) || 0,
      uploadedAt: item.createdAt || item.uploadedAt || null,
    }));
}
