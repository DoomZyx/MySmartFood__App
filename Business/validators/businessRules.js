import { VALID_SIZES } from "../../Config/defaults/pricingDefaults.js";
import { isHhmm, minutesOf, normalizeHhmm } from "../../utils/timeZone.js";

export class BusinessRuleError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = "BusinessRuleError";
  }
}

export function digitsOnly(phone) {
  if (phone == null || phone === "") return "";
  return String(phone).replace(/\D/g, "");
}

export function assertPhone(phone, { required = true } = {}) {
  const digits = digitsOnly(phone);
  if (!digits) {
    if (required) throw new BusinessRuleError("Numéro de téléphone invalide ou manquant.");
    return "";
  }
  if (digits.length < 10) {
    throw new BusinessRuleError("Numéro de téléphone invalide ou manquant.");
  }
  return digits;
}

export function assertHhmm(value, label = "heure") {
  const normalized = normalizeHhmm(value);
  if (!normalized || !isHhmm(normalized)) {
    throw new BusinessRuleError(`${label} invalide ou manquante.`);
  }
  return normalized;
}

export function assertPriceCents(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new BusinessRuleError("Le prix doit être un entier en centimes supérieur ou égal à 0");
  }
  if (n === 0) {
    throw new BusinessRuleError("Le prix doit être supérieur à 0");
  }
  return n;
}

export function assertProduct(product, category) {
  const errors = [];
  if (!product?.nom || String(product.nom).trim().length === 0) {
    errors.push("Le nom du produit est obligatoire");
  }
  const price = Number(product?.prixBase);
  if (!Number.isFinite(price) || price <= 0) {
    errors.push("Le prix doit être supérieur à 0");
  }
  if (category === "pizzas" && product.taille && !VALID_SIZES.pizzas.includes(product.taille)) {
    errors.push(`Taille invalide pour les pizzas. Valeurs acceptées: ${VALID_SIZES.pizzas.join(", ")}`);
  }
  if (category === "boissons" && product.taille && !VALID_SIZES.boissons.includes(product.taille)) {
    errors.push(`Taille invalide pour les boissons. Valeurs acceptées: ${VALID_SIZES.boissons.join(", ")}`);
  }
  if (errors.length) {
    throw new BusinessRuleError(errors.join(", "));
  }
}

export function assertOptionSelection(group, selectedNames) {
  const names = Array.isArray(selectedNames) ? selectedNames.filter(Boolean) : [];
  const min = group.minSelect ?? (group.isRequired ? 1 : 0);
  const max = group.maxSelect ?? (group.selectionType === "single" ? 1 : names.length);
  if (group.isRequired && names.length < Math.max(min, 1)) {
    throw new BusinessRuleError(`L'option ${group.name} est obligatoire`);
  }
  if (names.length < min) {
    throw new BusinessRuleError(`Sélection insuffisante pour ${group.name}`);
  }
  if (max != null && names.length > max) {
    throw new BusinessRuleError(`Trop de choix pour ${group.name}`);
  }
}

export function assertPartySize(size) {
  const n = Number(size);
  if (!Number.isInteger(n) || n < 1 || n > 100) {
    throw new BusinessRuleError("nombrePersonnes doit être entre 1 et 100");
  }
  return n;
}

export function assertCapacity(requested, remaining) {
  if (remaining == null) return;
  if (requested > remaining) {
    const err = new BusinessRuleError("Capacité insuffisante pour ce service", 409);
    err.remainingCovers = remaining;
    err.requestedCovers = requested;
    throw err;
  }
}

export function isTimeInSlot(hhmm, slot) {
  if (!slot?.ouverture || !slot?.fermeture) return false;
  const t = minutesOf(hhmm);
  const start = minutesOf(slot.ouverture);
  const end = minutesOf(slot.fermeture);
  if (end > start) return t >= start && t <= end;
  return t >= start || t <= end;
}

export function slotKindForTime(hhmm, dayHours) {
  if (isTimeInSlot(hhmm, dayHours?.midi)) return "midi";
  if (isTimeInSlot(hhmm, dayHours?.soir)) return "soir";
  return null;
}
