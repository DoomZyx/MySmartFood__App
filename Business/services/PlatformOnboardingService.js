import crypto from "node:crypto";
import twilio from "twilio";
import * as Tenant from "../../models/pg/Tenant.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as User from "../../models/pg/User.js";
import * as Membership from "../../models/pg/Membership.js";
import * as Plan from "../../models/pg/Plan.js";
import * as Subscription from "../../models/pg/Subscription.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import {
  createProvisioningJob,
  markCompleted,
  markRejected,
} from "../../models/pg/ProvisioningJob.js";
import * as Contact from "../../models/pg/Contact.js";
import * as Demo from "../../models/pg/Demo.js";
import { withTenant, withTransaction } from "../../database/transaction.js";
import {
  incomingNumberVoiceUpdate,
  resolveVoicePublicHost,
  voiceWebhookSlug,
  voiceWebhookUrl,
} from "../../utils/voiceWebhookUrl.js";
import { encrypt } from "../../utils/encryption.js";
import {
  OPENAI_CHAT_MODEL,
  OPENAI_REALTIME_MODEL,
  sanitizeOpenAiKey,
  sanitizeOpenAiModel,
} from "../../Config/openaiModels.js";

const E164 = /^\+[1-9]\d{7,14}$/;
const PHONE_SID = /^PN[a-f0-9]{32}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COUNTRY_CODES = new Set(["FR", "BE", "LU"]);
const COUNTRY_LABELS = { FR: "France", BE: "Belgique", LU: "Luxembourg" };
const COUNTRY_FROM_LABEL = { France: "FR", Belgique: "BE", Luxembourg: "LU" };
const REQUIRED_DOC_KINDS = ["kbis", "id_recto", "id_verso", "address_proof"];
const TENANT_STATUSES = new Set([
  "pending_payment",
  "pending_compliance",
  "active",
  "suspended",
]);

function twilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    const err = new Error("Twilio non configuré");
    err.statusCode = 503;
    throw err;
  }
  return twilio(sid, token);
}

export function buildValidationChecklist(row) {
  const kinds = Array.isArray(row?.documentKinds) ? row.documentKinds : [];
  const docsOk =
    row?.onboardedBy === "platform" ||
    Boolean(row?.documentsSubmittedAt) ||
    REQUIRED_DOC_KINDS.every((kind) => kinds.includes(kind));
  const items = [
    { key: "businessName", label: "Nom établissement", ok: Boolean(row?.businessName || row?.name) },
    { key: "ownerEmail", label: "E-mail propriétaire", ok: Boolean(row?.ownerEmail) },
    {
      key: "address",
      label: "Adresse complète",
      ok: Boolean(row?.addressLine && row?.postalCode && row?.city),
    },
    { key: "restaurantPhone", label: "Téléphone établissement", ok: Boolean(row?.restaurantPhone) },
    {
      key: "phoneNumberUsage",
      label: "Usage du numéro",
      ok: String(row?.phoneNumberUsage || "").trim().length >= 15,
    },
    { key: "documents", label: "Dossier pièces", ok: docsOk },
    { key: "inboundNumber", label: "Numéro vocal attribué", ok: Boolean(row?.phoneNumber) },
  ];
  return {
    items,
    ready: items.every((item) => item.ok),
  };
}

function serializeTenant(row, publicHost) {
  if (!row) return null;
  const documentKinds = Array.isArray(row.documentKinds) ? row.documentKinds : [];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    countryCode: row.countryCode,
    ownerUserId: row.ownerUserId || null,
    ownerEmail: row.ownerEmail,
    ownerName: row.ownerName,
    planSlug: row.planSlug,
    planName: row.planName,
    subscriptionStatus: row.subscriptionStatus,
    provisioningState: row.provisioningState,
    provisioningError: row.provisioningError,
    phoneNumber: row.phoneNumber || null,
    phoneNumberSid: row.phoneNumberSid || null,
    restaurantPhone: row.restaurantPhone || null,
    restaurantEmail: row.restaurantEmail || null,
    businessName: row.businessName || null,
    addressLine: row.addressLine || null,
    postalCode: row.postalCode || null,
    city: row.city || null,
    profileCountry: row.profileCountry || COUNTRY_LABELS[row.countryCode] || null,
    seatCount: row.seatCount ?? null,
    cuisineType: row.cuisineType || null,
    phoneNumberUsage: row.phoneNumberUsage || null,
    documentsSubmittedAt: row.documentsSubmittedAt || null,
    documentKinds,
    onboardedBy: row.onboardedBy || "self",
    openaiKeyConfigured: Boolean(row.openaiKeyConfigured || row.openaiApiKey),
    openaiModel: row.openaiModel || OPENAI_REALTIME_MODEL,
    openaiRealtimeModel: OPENAI_REALTIME_MODEL,
    openaiChatModel: OPENAI_CHAT_MODEL,
    bundleStatus: row.bundleStatus || null,
    checklist: buildValidationChecklist({ ...row, documentKinds }),
    needsReview: Boolean(
      row.documentsSubmittedAt && row.status !== "active" && row.status !== "closed"
    ),
    voiceWebhookSlug: voiceWebhookSlug(row.slug),
    voiceWebhookUrl: voiceWebhookUrl(row.slug, publicHost),
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
  };
}

async function presentTenants(rows) {
  const publicHost = await resolveVoicePublicHost();
  return rows.map((row) => serializeTenant(row, publicHost));
}

async function presentTenant(row) {
  if (!row) return null;
  const publicHost = await resolveVoicePublicHost();
  return serializeTenant(row, publicHost);
}

export async function listTenants({ status, queue, limit } = {}) {
  if (status && !TENANT_STATUSES.has(status)) {
    const err = new Error("Statut invalide");
    err.statusCode = 400;
    throw err;
  }
  const rows =
    queue === "pending"
      ? await Tenant.listPendingForPlatform({ limit })
      : queue === "fleet"
        ? await Tenant.listFleetForPlatform({ limit })
        : await Tenant.listForPlatform({ status, limit });
  return presentTenants(rows);
}

export async function getInbox() {
  const openStatuses = ["nouveau", "en_cours"];
  const [tenants, contacts, demos] = await Promise.all([
    Tenant.listPendingForPlatform({ limit: 100 }),
    Contact.findWithFilter({ statuses: openStatuses, limit: 50, offset: 0 }),
    Demo.findWithFilter({ statuses: openStatuses, limit: 50 }),
  ]);
  return {
    tenants: await presentTenants(tenants),
    contacts,
    demos,
  };
}

export async function getTenant(tenantId) {
  const row = await Tenant.findForPlatform(tenantId);
  if (!row) {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  return presentTenant(row);
}

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

function hasOpenTenant(memberships) {
  return (memberships || []).some((item) => item.status && item.status !== "closed");
}

async function persistOpenAiFallback(tenantId, body = {}) {
  const model = sanitizeOpenAiModel(body.openaiModel);
  const key = sanitizeOpenAiKey(body.openaiApiKey);
  if (!model && !key) return;
  await Tenant.updateOpenAi(null, tenantId, {
    apiKey: key ? encrypt(key) : undefined,
    model: model || undefined,
  });
  if (model) {
    await withTenant(tenantId, (db) =>
      db.query(
        `UPDATE tenant_settings SET voice_model = $2 WHERE tenant_id = $1`,
        [tenantId, model]
      )
    );
  }
}

async function allocateSlug(client, name, userId) {
  let suffix = String(userId).replace(/-/g, "").slice(0, 8);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = Tenant.slugFromName(name, suffix);
    const taken = await client.query(
      `SELECT 1 FROM tenants WHERE slug = $1 LIMIT 1`,
      [slug]
    );
    if (taken.rowCount === 0) return slug;
    suffix = crypto.randomBytes(4).toString("hex");
  }
  httpError("Impossible de générer un identifiant d'établissement", 500);
}

function normalizeCountry(countryCode, countryLabel) {
  const codeRaw = String(countryCode || "").trim().toUpperCase();
  if (COUNTRY_CODES.has(codeRaw)) {
    return { code: codeRaw, label: COUNTRY_LABELS[codeRaw] };
  }
  const labelRaw = String(countryLabel || "").trim();
  if (COUNTRY_FROM_LABEL[labelRaw]) {
    return { code: COUNTRY_FROM_LABEL[labelRaw], label: labelRaw };
  }
  return { code: "FR", label: COUNTRY_LABELS.FR };
}

function optionalText(value, maxLen) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLen);
}

function optionalSeatCount(value) {
  if (value == null || value === "") return null;
  const seats = parseInt(String(value), 10);
  if (Number.isNaN(seats) || seats < 1 || seats > 999) {
    httpError("nombreCouverts doit être entre 1 et 999", 400);
  }
  return seats;
}

function profileFromInput(body, fallback = {}) {
  const country = normalizeCountry(body.countryCode, body.country || body.profileCountry);
  return {
    businessName:
      optionalText(body.name || body.businessName, 200) || fallback.businessName || null,
    addressLine:
      optionalText(body.addressLine || body.adresse, 300) || fallback.addressLine || "",
    postalCode:
      optionalText(body.postalCode || body.codePostal, 10) || fallback.postalCode || "",
    city: optionalText(body.city || body.ville, 100) || fallback.city || "",
    country: country.label,
    phone:
      optionalText(body.restaurantPhone || body.telephone || body.phone, 30) ||
      fallback.phone ||
      "",
    email:
      optionalText(body.restaurantEmail || body.email, 255) || fallback.email || "",
    seatCount:
      body.seatCount !== undefined || body.nombreCouverts !== undefined
        ? optionalSeatCount(body.seatCount ?? body.nombreCouverts)
        : fallback.seatCount ?? null,
    cuisineType:
      optionalText(body.cuisineType || body.typeCuisine, 100) || fallback.cuisineType || null,
    phoneNumberUsage:
      optionalText(body.phoneNumberUsage || body.twilioNumberUsage, 2000) ||
      fallback.phoneNumberUsage ||
      null,
  };
}

export function parseOptionalInboundPhone({ phoneNumber, phoneNumberSid } = {}) {
  const sid = String(phoneNumberSid || "").trim();
  const e164 = String(phoneNumber || "").trim();
  if (sid) {
    if (!PHONE_SID.test(sid)) httpError("SID Twilio invalide", 400);
    return { phoneNumberSid: sid };
  }
  if (!e164) return null;
  if (!E164.test(e164)) {
    httpError("Numéro invalide (format E.164, ex. +33123456789)", 400);
  }
  return { phoneNumber: e164 };
}

/**
 * Crée un établissement depuis le back-office : compte owner, resto actif, dashboard ouvert.
 * Le numéro Twilio est optionnel (réutilise assignInboundNumber).
 */
export async function createPlatformTenant({
  email,
  password,
  name,
  ownerName,
  countryCode,
  country,
  phoneNumber,
  phoneNumberSid,
  restaurantPhone,
  restaurantEmail,
  addressLine,
  postalCode,
  city,
  seatCount,
  cuisineType,
  phoneNumberUsage,
  openaiApiKey,
  openaiModel,
} = {}) {
  const emailNorm = String(email || "").trim().toLowerCase();
  const plainPassword = String(password || "").trim();
  const businessName = String(name || "").trim();
  const resolvedCountry = normalizeCountry(countryCode, country);
  const ownerLabel = String(ownerName || "").trim() || businessName;
  const restoPhone = String(restaurantPhone || "").trim() || null;

  if (!EMAIL.test(emailNorm)) httpError("Adresse e-mail invalide", 400);
  if (plainPassword.length < 8) {
    httpError("Le mot de passe doit contenir au moins 8 caractères", 400);
  }
  if (!businessName) httpError("Nom de l'établissement requis", 400);

  const inbound = parseOptionalInboundPhone({ phoneNumber, phoneNumberSid });
  const profile = profileFromInput({
    name: businessName,
    countryCode: resolvedCountry.code,
    addressLine,
    postalCode,
    city,
    restaurantPhone: restoPhone,
    restaurantEmail: restaurantEmail || emailNorm,
    seatCount,
    cuisineType,
    phoneNumberUsage,
    email: emailNorm,
  });

  const plan = (await Plan.findBySlug("beta")) || (await Plan.findBySlug("developpeur"));
  if (!plan) {
    httpError("Plan beta indisponible. Lancer les migrations.", 500);
  }

  let user = await User.findByEmail(emailNorm);
  if (user) {
    const memberships = await Membership.listByUserId(user.id);
    if (hasOpenTenant(memberships)) {
      httpError("Ce compte possède déjà un établissement", 409);
    }
    await User.setPassword(user.id, plainPassword);
  } else {
    user = await User.create({
      email: emailNorm,
      name: ownerLabel,
      password: plainPassword,
      emailVerified: true,
    });
  }

  let tenantId = null;
  await withTransaction(async (client) => {
    const slug = await allocateSlug(client, businessName, user.id);
    const tenant = await Tenant.createTenant(client, {
      slug,
      name: businessName,
      ownerUserId: user.id,
      countryCode: resolvedCountry.code,
      status: "active",
      onboardedBy: "platform",
    });
    tenantId = tenant.id;
    await Membership.createMembership(client, {
      tenantId,
      userId: user.id,
      role: "owner",
    });
    await createProvisioningJob(client, tenantId);
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + 2);
    await Subscription.createManual(client, {
      tenantId,
      planId: plan.id,
      status: "active",
      currentPeriodStart: new Date(),
      currentPeriodEnd: periodEnd,
    });
    await EstablishmentProfile.upsert(tenantId, profile, client);
  });

  await withTenant(tenantId, (tenantClient) =>
    tenantClient.query(
      `INSERT INTO tenant_settings (tenant_id) VALUES ($1) ON CONFLICT DO NOTHING`,
      [tenantId]
    )
  );
  await markCompleted(tenantId);
  await User.markDashboardUnlocked(user.id);

  if (inbound) {
    await assignInboundNumber(tenantId, inbound);
  }
  await persistOpenAiFallback(tenantId, { openaiApiKey, openaiModel });

  return {
    tenant: await getTenant(tenantId),
    temporaryPassword: plainPassword,
  };
}

export async function updatePlatformTenant(tenantId, body = {}) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    httpError("Établissement introuvable", 404);
  }

  const currentProfile = await EstablishmentProfile.findByTenantId(tenantId);
  const nextName = optionalText(body.name || body.businessName, 200);
  const country = body.countryCode || body.country || body.profileCountry
    ? normalizeCountry(body.countryCode, body.country || body.profileCountry)
    : { code: tenant.countryCode, label: currentProfile?.country || COUNTRY_LABELS[tenant.countryCode] };

  await Tenant.updateDetails(null, tenantId, {
    name: nextName,
    countryCode: country.code,
  });

  const profile = profileFromInput(
    {
      ...body,
      name: nextName || currentProfile?.businessName || tenant.name,
      countryCode: country.code,
      restaurantEmail: body.restaurantEmail || currentProfile?.email,
    },
    currentProfile || {}
  );
  await EstablishmentProfile.upsert(tenantId, profile);

  const ownerName = optionalText(body.ownerName, 120);
  const ownerEmail = optionalText(body.email, 255);
  const nextPassword = String(body.password || "").trim();
  if (ownerName || ownerEmail) {
    try {
      await User.updateAccount(tenant.ownerUserId, {
        name: ownerName,
        email: ownerEmail,
      });
    } catch (error) {
      if (/déjà utilisé/i.test(error.message)) httpError(error.message, 409);
      if (/invalide/i.test(error.message)) httpError(error.message, 400);
      throw error;
    }
  }
  if (nextPassword) {
    if (nextPassword.length < 8) {
      httpError("Le mot de passe doit contenir au moins 8 caractères", 400);
    }
    await User.setPassword(tenant.ownerUserId, nextPassword);
  }

  const inbound = parseOptionalInboundPhone({
    phoneNumber: body.phoneNumber,
    phoneNumberSid: body.phoneNumberSid,
  });
  if (inbound) {
    await assignInboundNumber(tenantId, inbound);
  }
  await persistOpenAiFallback(tenantId, body);

  return {
    tenant: await getTenant(tenantId),
    temporaryPassword: nextPassword || undefined,
  };
}

async function fetchIncomingNumber(client, { phoneNumber, phoneNumberSid }) {
  if (phoneNumberSid) {
    try {
      return await client.incomingPhoneNumbers(phoneNumberSid).fetch();
    } catch {
      const err = new Error("Numéro Twilio introuvable (SID)");
      err.statusCode = 400;
      throw err;
    }
  }
  const listed = await client.incomingPhoneNumbers.list({ phoneNumber, limit: 1 });
  if (!listed[0]) {
    const err = new Error("Ce numéro n'est pas sur le compte Twilio");
    err.statusCode = 400;
    throw err;
  }
  return listed[0];
}

/**
 * Pointe le numéro Twilio vers le webhook vocal unique, puis enregistre le numéro.
 */
export async function assignInboundNumber(tenantId, { phoneNumber, phoneNumberSid } = {}) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }

  const voiceUpdate = await incomingNumberVoiceUpdate(tenant.slug);
  if (!voiceUpdate) {
    const err = new Error(
      "URL publique introuvable. Lance ngrok vers le port 8080 (un seul tunnel)."
    );
    err.statusCode = 503;
    throw err;
  }

  const sid = String(phoneNumberSid || "").trim();
  const e164 = String(phoneNumber || "").trim();
  if (sid && !PHONE_SID.test(sid)) {
    const err = new Error("SID Twilio invalide");
    err.statusCode = 400;
    throw err;
  }
  if (!sid && !E164.test(e164)) {
    const err = new Error("Numéro invalide (format E.164, ex. +33123456789)");
    err.statusCode = 400;
    throw err;
  }

  const client = twilioClient();
  const incoming = await fetchIncomingNumber(client, {
    phoneNumber: e164 || undefined,
    phoneNumberSid: sid || undefined,
  });

  const assignedNumber = incoming.phoneNumber || incoming.phone_number;
  if (!assignedNumber) {
    const err = new Error("Twilio n'a pas renvoyé le numéro E.164 pour ce SID");
    err.statusCode = 502;
    throw err;
  }

  const taken = await TwilioBundle.findByPhoneNumber(assignedNumber);
  if (taken && taken.tenantId !== tenantId) {
    const err = new Error("Ce numéro est déjà attribué à un autre établissement");
    err.statusCode = 409;
    throw err;
  }

  await client.incomingPhoneNumbers(incoming.sid).update(voiceUpdate);

  await TwilioBundle.assignNumber(tenantId, {
    phoneNumber: assignedNumber,
    phoneNumberSid: incoming.sid,
    bundleSid: `manual-${tenantId}`,
  });

  await setPhoneLineEnabled(tenantId, tenant.status === "active");

  return getTenant(tenantId);
}

async function setPhoneLineEnabled(tenantId, enabled) {
  await withTenant(tenantId, (db) =>
    db.query(
      `INSERT INTO tenant_settings (tenant_id, phone_line_enabled)
       VALUES ($1, $2)
       ON CONFLICT (tenant_id) DO UPDATE SET phone_line_enabled = $2`,
      [tenantId, enabled]
    )
  );
}

export async function activateTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }

  await Tenant.updateStatus(null, tenantId, "active");
  await User.markDashboardUnlocked(tenant.ownerUserId);
  await markCompleted(tenantId);
  const bundle = await TwilioBundle.findByTenantId(tenantId);
  if (bundle?.phoneNumberSid) {
    await setPhoneLineEnabled(tenantId, true);
  }
  return getTenant(tenantId);
}

export async function suspendTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  if (tenant.status !== "active") {
    const err = new Error("Seul un établissement actif peut être suspendu");
    err.statusCode = 409;
    throw err;
  }

  await Tenant.updateStatus(null, tenantId, "suspended");
  await setPhoneLineEnabled(tenantId, false);
  return getTenant(tenantId);
}

export async function rejectTenant(tenantId, reason) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  if (tenant.status === "active") {
    const err = new Error("Un établissement actif ne peut pas être refusé");
    err.statusCode = 409;
    throw err;
  }
  const note = String(reason || "").trim().slice(0, 500) || "Dossier refuse par le back-office";
  await Tenant.updateStatus(null, tenantId, "suspended");
  await markRejected(tenantId, note);
  return getTenant(tenantId);
}

export async function closeTenant(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }

  await Tenant.updateStatus(null, tenantId, "closed");
  await TwilioBundle.releaseNumber(tenantId);
  await setPhoneLineEnabled(tenantId, false);
  await markRejected(tenantId, "Établissement supprimé par le back-office");
  return { id: tenantId, status: "closed" };
}
