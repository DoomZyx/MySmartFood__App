/**
 * Normalise le numéro transmis par Twilio pour les données métier.
 * Les numéros français E.164 sont convertis au format national.
 *
 * @param {unknown} value
 * @returns {string|null}
 */
export function normalizeCallerPhone(value) {
  if (typeof value !== "string") return null;

  const raw = value.trim();
  if (!raw || /^(anonymous|private|restricted|unknown)$/i.test(raw)) {
    return null;
  }

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0033") && digits.length === 13) {
    digits = `0${digits.slice(4)}`;
  } else if (digits.startsWith("33") && digits.length === 11) {
    digits = `0${digits.slice(2)}`;
  }

  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  return digits.length === 10
    ? digits.replace(/(\d{2})(?=\d)/g, "$1 ")
    : raw;
}
