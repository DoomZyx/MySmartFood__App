function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function isLuhnValid(digits) {
  const text = String(digits || "");
  if (!/^[0-9]+$/.test(text)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = text.length - 1; index >= 0; index -= 1) {
    let number = Number(text[index]);
    if (doubleDigit) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    sum += number;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function invalid(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

/**
 * SIRET (14) prioritaire. SIREN (9) accepté si le SIRET n'est pas connu.
 */
export function parseCompanyRegistration(
  { siret, siren, companyNumber } = {},
  { required = false } = {}
) {
  const primary = digitsOnly(siret || companyNumber || "");
  const fallback = digitsOnly(siren || "");

  if (!primary && !fallback) {
    if (required) {
      throw invalid("Indiquez un SIRET (14 chiffres) ou, à défaut, un SIREN (9 chiffres)");
    }
    return { siret: null, siren: null };
  }

  if (primary.length === 14) {
    if (!isLuhnValid(primary) || !isLuhnValid(primary.slice(0, 9))) {
      throw invalid("SIRET invalide");
    }
    return { siret: primary, siren: primary.slice(0, 9) };
  }

  if (primary.length === 9) {
    if (!isLuhnValid(primary)) throw invalid("SIREN invalide");
    return { siret: null, siren: primary };
  }

  if (!primary && fallback.length === 9) {
    if (!isLuhnValid(fallback)) throw invalid("SIREN invalide");
    return { siret: null, siren: fallback };
  }

  throw invalid("Indiquez un SIRET (14 chiffres) ou, à défaut, un SIREN (9 chiffres)");
}

export function hasCompanyRegistration(row) {
  return Boolean(row?.siret || row?.siren);
}
