import crypto from "node:crypto";

/**
 * Compare deux secrets en temps constant.
 * Refuse si l'un des deux est absent, pour éviter un match sur chaînes vides.
 */
export function timingSafeEqualString(expected, provided) {
  if (typeof expected !== "string" || typeof provided !== "string") {
    return false;
  }
  if (expected.length === 0 || provided.length === 0) {
    return false;
  }
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(a.length);
    crypto.timingSafeEqual(a, dummy);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}
