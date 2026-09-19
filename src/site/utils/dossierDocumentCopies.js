import { REQUIRED_DOC_SLOTS } from "./dossierModeration.js";

const EXTRA_LABELS = {
  kbis: "KBIS / extrait Kbis",
};

export function dossierCopySlots(documents) {
  const records = Array.isArray(documents) ? documents : [];
  const byKind = Object.fromEntries(
    records.filter((item) => item?.kind).map((item) => [item.kind, item])
  );
  const required = REQUIRED_DOC_SLOTS.map((slot) => ({
    ...slot,
    document: byKind[slot.kind] || null,
  })).filter((slot) => slot.document);
  const extras = records
    .filter((item) => item?.kind && !REQUIRED_DOC_SLOTS.some((slot) => slot.kind === item.kind))
    .map((item) => ({
      kind: item.kind,
      key: `doc_${item.kind}`,
      label: EXTRA_LABELS[item.kind] || item.kind,
      document: item,
    }));
  return [...required, ...extras];
}

export function formatDocumentBytes(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDocumentDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
