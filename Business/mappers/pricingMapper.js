import { DAYS_FR } from "../../utils/timeZone.js";
import { centsToEuros, slugify } from "./legacyStatus.js";

const NAMED_SIZES = {
  petite: "Petite",
  moyenne: "Moyenne",
  grande: "Grande",
  s: "S",
  m: "M",
  l: "L",
  xl: "XL",
};

const VOLUME_RE = /(\d+(?:[.,]\d+)?)\s*(cl|l)\b/i;

/** Taille explicite, sinon libellé unique dans la description (Petite / 33cl). */
export function resolveSizeLabel(product) {
  const explicit = String(product?.taille || "").trim();
  if (explicit) return explicit;
  const desc = String(product?.description || "").trim();
  if (!desc) return null;
  const named = NAMED_SIZES[desc.toLowerCase()];
  if (named) return named;
  const volume = desc.match(VOLUME_RE);
  if (!volume) return null;
  const amount = volume[1].replace(",", ".");
  const unit = volume[2].toLowerCase();
  if (unit === "l") return amount === "1" ? "1L" : `${amount}L`;
  return `${amount}cl`;
}

export function emptyHoraires() {
  const horaires = {};
  for (const day of DAYS_FR) {
    horaires[day] = { ouvert: false };
  }
  return horaires;
}

export function hoursToLegacy(slots) {
  const horaires = emptyHoraires();
  for (const slot of slots || []) {
    const day = DAYS_FR[slot.dayOfWeek];
    if (!day) continue;
    horaires[day].ouvert = true;
    horaires[day][slot.slotKind] = {
      ouverture: slot.opensAt,
      fermeture: slot.closesAt,
    };
  }
  return horaires;
}

export function hoursFromLegacy(horaires) {
  const slots = [];
  for (let dayOfWeek = 0; dayOfWeek < DAYS_FR.length; dayOfWeek += 1) {
    const day = DAYS_FR[dayOfWeek];
    const block = horaires?.[day];
    if (!block || block.ouvert === false) continue;
    for (const slotKind of ["midi", "soir"]) {
      const slot = block[slotKind];
      if (!slot?.ouverture || !slot?.fermeture) continue;
      const closesNextDay = slot.fermeture <= slot.ouverture;
      slots.push({
        dayOfWeek,
        slotKind,
        opensAt: slot.ouverture,
        closesAt: slot.fermeture,
        closesNextDay,
      });
    }
  }
  return slots;
}

export function itemToLegacyProduct(item, catalog) {
  const groups = (catalog.links || [])
    .filter((link) => link.itemId === item.id)
    .map((link) => catalog.groups.find((group) => group.id === link.groupId))
    .filter(Boolean);
  const options = {};
  for (const group of groups) {
    const choix = catalog.options
      .filter((option) => option.groupId === group.id)
      .map((option) => option.name);
    const legacySlug = group.legacyPayload?.slug || group.slug;
    options[legacySlug] = {
      nom: group.name,
      type: group.selectionType,
      obligatoire: group.isRequired,
      max: group.maxSelect,
      min: group.minSelect,
      choix,
    };
  }
  const compositions = (catalog.compositions || []).filter((row) => row.itemId === item.id);
  const plat = compositions.find((row) => row.role === "plat_principal");
  return {
    _id: item.id,
    nom: item.legacyPayload?.nom || item.name,
    description: item.description || "",
    prixBase: centsToEuros(item.priceCents),
    disponible: item.isAvailable,
    taille: item.sizeLabel || undefined,
    personnalisable: item.isCustomizable || undefined,
    maxViandes: item.maxMeats || undefined,
    ingredientsInclus: item.includedIngredients || {},
    ingredientsDisponibles: item.availableIngredients || {},
    options,
    composition: plat || compositions.length
      ? {
          platPrincipal: plat?.label || plat?.componentItemId || null,
        }
      : undefined,
  };
}

export function catalogToMenuPricing(catalog) {
  const menuPricing = {};
  for (const category of catalog.categories) {
    const slug = category.slug || slugify(category.name);
    menuPricing[slug] = {
      nom: category.name,
      produits: catalog.items
        .filter((item) => item.categoryId === category.id)
        .map((item) => itemToLegacyProduct(item, catalog)),
    };
  }
  return menuPricing;
}

export function restaurantInfoFromProfile(profile, horaires, amenities = []) {
  return {
    nom: profile?.businessName || "Mon Restaurant",
    adresse: profile?.rawAddress || profile?.addressLine || "",
    telephone: profile?.phone || "",
    email: profile?.email || "",
    nombreCouverts: profile?.seatCount || 0,
    typeCuisine: profile?.cuisineType || "",
    horairesOuverture: horaires,
    equipements: amenities.map((item) => ({
      slug: item.slug,
      label: item.label,
      status: item.status,
      quantity: item.quantity,
      details: item.details,
    })),
  };
}
