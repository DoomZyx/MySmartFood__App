const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const PHONE_SID = /^PN[a-f0-9]{32}$/i;
const COUNTRY_CODES = new Set(["FR", "BE", "LU"]);
const COUNTRY_FROM_LABEL = {
  France: "FR",
  Belgique: "BE",
  Luxembourg: "LU",
};

export const REQUIRED_DOC_SLOTS = [
  { kind: "id_recto", key: "doc_id_recto", label: "Pièce d'identité recto" },
  { kind: "id_verso", key: "doc_id_verso", label: "Pièce d'identité verso" },
  { kind: "address_proof", key: "doc_address_proof", label: "Justificatif d'adresse" },
];

function text(value) {
  if (value == null) return "";
  return String(value).trim();
}

function digitsOnly(value) {
  return text(value).replace(/\D/g, "");
}

function isLuhnValid(digits) {
  const raw = String(digits || "");
  if (!/^[0-9]+$/.test(raw)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = raw.length - 1; index >= 0; index -= 1) {
    let number = Number(raw[index]);
    if (doubleDigit) {
      number *= 2;
      if (number > 9) number -= 9;
    }
    sum += number;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function firstText(...values) {
  for (const value of values) {
    const next = text(value);
    if (next) return next;
  }
  return "";
}

function countryCodeOf(tenant, draft) {
  const fromDraft = text(draft?.countryCode).toUpperCase();
  if (COUNTRY_CODES.has(fromDraft)) return fromDraft;
  const fromTenant = text(tenant?.countryCode).toUpperCase();
  if (COUNTRY_CODES.has(fromTenant)) return fromTenant;
  const fromLabel = COUNTRY_FROM_LABEL[text(tenant?.profileCountry)] || "";
  return fromLabel || fromDraft || fromTenant;
}

function registrationIssue(value) {
  const digits = digitsOnly(value);
  if (!digits) return { empty: true };
  if (digits.length === 14) {
    if (!isLuhnValid(digits) || !isLuhnValid(digits.slice(0, 9))) {
      return { reason: "SIRET invalide (clé de contrôle)" };
    }
    return null;
  }
  if (digits.length === 9) {
    if (!isLuhnValid(digits)) return { reason: "SIREN invalide (clé de contrôle)" };
    return null;
  }
  return { reason: "Doit faire 14 chiffres (SIRET) ou 9 (SIREN)" };
}

function postalIssue(postal, countryCode) {
  const value = text(postal);
  if (!value) return { empty: true };
  if (countryCode === "FR" && !/^\d{5}$/.test(value)) {
    return { reason: "Code postal FR : 5 chiffres" };
  }
  if ((countryCode === "BE" || countryCode === "LU") && !/^\d{4}$/.test(value)) {
    return { reason: `Code postal ${countryCode} : 4 chiffres` };
  }
  return null;
}

function inboundIssue(value) {
  const raw = text(value);
  if (!raw) return { empty: true };
  if (PHONE_SID.test(raw)) return null;
  const e164 = `+${digitsOnly(raw)}`;
  if (!E164.test(e164)) {
    return { reason: "Format attendu : +12768811832, +33123456789 ou SID PN…" };
  }
  return null;
}

function documentKindsOf(tenant) {
  if (Array.isArray(tenant?.documentKinds) && tenant.documentKinds.length) {
    return tenant.documentKinds;
  }
  return (Array.isArray(tenant?.documents) ? tenant.documents : [])
    .map((item) => item?.kind)
    .filter(Boolean);
}

function pushItem(items, item) {
  items.push({
    value: "",
    reason: "",
    ...item,
  });
}

export function auditDossier({ tenant, draft, users } = {}) {
  const platform = tenant?.onboardedBy === "platform";
  const items = [];
  const ownerUser = (users || []).find((user) => user?.role === "owner") || null;
  const countryCode = countryCodeOf(tenant, draft);
  const ownerEmail = firstText(draft?.email, tenant?.ownerEmail, ownerUser?.email);
  const restaurantEmail = firstText(draft?.restaurantEmail, tenant?.restaurantEmail);
  const registration = firstText(draft?.siret, tenant?.siret, tenant?.siren);
  const inbound = firstText(draft?.inboundPhone, tenant?.phoneNumber, tenant?.phoneNumberSid);
  const usage = firstText(draft?.phoneNumberUsage, tenant?.phoneNumberUsage);
  const postal = firstText(draft?.postalCode, tenant?.postalCode);
  const kinds = documentKindsOf(tenant);

  const fields = [
    {
      key: "name",
      label: "Nom de l'établissement",
      value: firstText(draft?.name, tenant?.businessName, tenant?.name),
    },
    {
      key: "ownerName",
      label: "Nom du propriétaire",
      value: firstText(draft?.ownerName, tenant?.ownerName, ownerUser?.name),
    },
    {
      key: "email",
      label: "E-mail propriétaire",
      value: ownerEmail,
      mismatchIf: (value) => value && !EMAIL.test(value),
      mismatchReason: "Adresse e-mail invalide",
    },
    {
      key: "restaurantEmail",
      label: "E-mail établissement",
      value: restaurantEmail,
      mismatchIf: (value) => value && !EMAIL.test(value),
      mismatchReason: "Adresse e-mail invalide",
    },
    {
      key: "restaurantPhone",
      label: "Téléphone établissement",
      value: firstText(draft?.restaurantPhone, tenant?.restaurantPhone),
      mismatchIf: (value) => value && digitsOnly(value).length < 8,
      mismatchReason: "Numéro trop court",
    },
    {
      key: "addressLine",
      label: "Adresse",
      value: firstText(draft?.addressLine, tenant?.addressLine),
    },
    {
      key: "postalCode",
      label: "Code postal",
      value: postal,
      mismatchIf: () => Boolean(postalIssue(postal, countryCode)?.reason),
      mismatchReason: postalIssue(postal, countryCode)?.reason,
    },
    {
      key: "city",
      label: "Ville",
      value: firstText(draft?.city, tenant?.city),
    },
    {
      key: "countryCode",
      label: "Pays",
      value: countryCode,
      mismatchIf: (value) => value && !COUNTRY_CODES.has(value),
      mismatchReason: "Pays hors FR / BE / LU",
    },
    {
      key: "siret",
      label: "SIRET / SIREN",
      value: registration,
      required: !platform,
      mismatchIf: () => Boolean(registrationIssue(registration)?.reason),
      mismatchReason: registrationIssue(registration)?.reason,
    },
    {
      key: "phoneNumberUsage",
      label: "Usage du numéro",
      value: usage,
      mismatchIf: (value) => value && value.length < 15,
      mismatchReason: "Trop court (15 caractères minimum)",
    },
    {
      key: "inboundPhone",
      label: "Numéro Twilio déjà acheté",
      value: inbound,
      mismatchIf: () => Boolean(inboundIssue(inbound)?.reason),
      mismatchReason: inboundIssue(inbound)?.reason,
    },
  ];

  fields.forEach((field) => {
    const value = text(field.value);
    const required = field.required !== false;
    if (!value) {
      if (required) {
        pushItem(items, {
          key: field.key,
          label: field.label,
          status: "missing",
          reason: "Manquant",
        });
      } else {
        pushItem(items, {
          key: field.key,
          label: field.label,
          status: "ok",
        });
      }
      return;
    }
    const mismatchReason =
      typeof field.mismatchIf === "function"
        ? field.mismatchIf(value) === true
          ? field.mismatchReason
          : field.mismatchIf(value) || ""
        : "";
    if (mismatchReason) {
      pushItem(items, {
        key: field.key,
        label: field.label,
        value,
        status: "mismatch",
        reason: typeof mismatchReason === "string" ? mismatchReason : field.mismatchReason,
      });
      return;
    }
    pushItem(items, {
      key: field.key,
      label: field.label,
      value,
      status: "ok",
    });
  });

  REQUIRED_DOC_SLOTS.forEach((slot) => {
    const present = kinds.includes(slot.kind);
    if (!present && !platform) {
      pushItem(items, {
        key: slot.key,
        label: slot.label,
        status: "missing",
        reason: "Pièce manquante",
      });
      return;
    }
    pushItem(items, {
      key: slot.key,
      label: slot.label,
      value: present ? slot.kind : "",
      status: "ok",
    });
  });

  const missing = items.filter((item) => item.status === "missing");
  const mismatch = items.filter((item) => item.status === "mismatch");
  return {
    items,
    missing,
    mismatch,
    okCount: items.filter((item) => item.status === "ok").length,
    byKey: Object.fromEntries(items.map((item) => [item.key, item])),
  };
}

export function scrollToDossierField(key) {
  const node = document.getElementById(`pte-field-${key}`);
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
}
