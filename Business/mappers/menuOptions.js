/** Normalise un choix d'option menu (string legacy ou { nom, prix }). */
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

export function formatChoiceLabel(entry) {
  const { nom, prix } = parseChoice(entry);
  if (!nom) return "";
  if (prix > 0) return `${nom} (+${prix.toFixed(2)}€)`;
  return nom;
}

export function formatOptionChoices(choix) {
  return (choix || []).map(formatChoiceLabel).filter(Boolean).join(", ");
}

export function selectedOptionNames(value) {
  if (value == null || value === "") return [];
  if (Array.isArray(value)) return value.flatMap(selectedOptionNames);
  if (typeof value === "object") {
    const nested = value.choix || value.selected || value.nom || value.name;
    if (nested != null) return selectedOptionNames(nested);
    return [];
  }
  return [String(value).trim()].filter(Boolean);
}

function normalizeKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function findCatalogOption(rows, groupKey, optionName) {
  const key = normalizeKey(groupKey);
  const name = normalizeKey(optionName);
  return (rows || []).find((row) => {
    const slug = normalizeKey(row.slug);
    const groupName = normalizeKey(row.groupName);
    const legacySlug = normalizeKey(row.legacyPayload?.slug);
    const groupMatches =
      slug === key ||
      groupName === key ||
      legacySlug === key ||
      slug.endsWith(`-${key}`);
    return groupMatches && normalizeKey(row.optionName) === name;
  });
}

export function formatAmenitiesForPrompt(restaurantInfo, amenities) {
  const list = amenities?.length
    ? amenities
    : restaurantInfo?.equipements || [];
  const pmr = list.find((item) => item.slug === "pmr");
  const highchair = list.find((item) => item.slug === "highchair");

  const pmrAvailable =
    pmr?.status === "available" || restaurantInfo?.accessibilitePmr === true;
  const pmrUnavailable =
    pmr?.status === "unavailable" || restaurantInfo?.accessibilitePmr === false;
  const pmrText = pmrAvailable
    ? "Oui, acces personnes a mobilite reduite disponible"
    : pmrUnavailable
      ? "Non, pas d'acces PMR"
      : "Non renseigne — ne pas inventer, proposer de confirmer aupres de l'equipe";

  const chairQty = Number(
    highchair?.quantity ?? restaurantInfo?.nombreChaisesBebe
  );
  let chairText;
  if (highchair?.status === "unavailable" || chairQty === 0) {
    chairText = "Aucune chaise bebe";
  } else if (Number.isFinite(chairQty) && chairQty > 0) {
    chairText = `${chairQty} chaise(s) bebe disponible(s)`;
  } else {
    chairText =
      "Non renseigne — ne pas inventer, proposer de confirmer aupres de l'equipe";
  }

  return `ACCESSIBILITE ET EQUIPEMENTS :
- Acces personnes a mobilite reduite (PMR / handicap) : ${pmrText}
- Chaises bebe / chaises hautes : ${chairText}

Si le client demande un acces PMR, une rampe, ou une chaise bebe, utilise UNIQUEMENT ces informations. Ne jamais inventer une disponibilite.`;
}
