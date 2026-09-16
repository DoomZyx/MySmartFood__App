export function parseChoice(entry) {
  if (entry == null) return { nom: "", prix: 0 };
  if (typeof entry === "string") {
    return { nom: entry.trim(), prix: 0 };
  }
  const nom = String(entry.nom || entry.name || "").trim();
  const raw = Number(entry.prix ?? entry.price ?? 0);
  const prix = Number.isFinite(raw) && raw > 0 ? raw : 0;
  return { nom, prix };
}

export function choiceName(entry) {
  return parseChoice(entry).nom;
}

export function choicePrice(entry) {
  return parseChoice(entry).prix;
}

export function formatChoiceLabel(entry) {
  const { nom, prix } = parseChoice(entry);
  if (!nom) return "";
  if (prix > 0) return `${nom} (+${prix.toFixed(2)}€)`;
  return nom;
}

export function computeUnitPrice(prixBase, productOptions, selectedOptions) {
  let total = Number(prixBase) || 0;
  for (const [key, selected] of Object.entries(selectedOptions || {})) {
    const group = productOptions?.[key];
    if (!group) continue;
    const names = Array.isArray(selected) ? selected : [selected];
    for (const name of names) {
      const selectedName = choiceName(name) || String(name || "");
      const match = (group.choix || []).find(
        (entry) => choiceName(entry) === selectedName
      );
      total += choicePrice(match);
    }
  }
  return Math.round(total * 100) / 100;
}
