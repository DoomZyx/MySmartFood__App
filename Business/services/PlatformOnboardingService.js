import twilio from "twilio";
import * as Tenant from "../../models/pg/Tenant.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as User from "../../models/pg/User.js";
import { markCompleted } from "../../models/pg/ProvisioningJob.js";
import { withTenant } from "../../database/transaction.js";
import { voiceWebhookUrl } from "../../utils/voiceWebhookUrl.js";

const E164 = /^\+[1-9]\d{7,14}$/;
const PHONE_SID = /^PN[a-f0-9]{32}$/i;
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

function serializeTenant(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status,
    countryCode: row.countryCode,
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
    businessName: row.businessName || null,
    documentsSubmittedAt: row.documentsSubmittedAt || null,
    voiceWebhookUrl: voiceWebhookUrl(row.slug),
    createdAt: row.createdAt,
    activatedAt: row.activatedAt,
  };
}

export async function listTenants({ status, limit } = {}) {
  if (status && !TENANT_STATUSES.has(status)) {
    const err = new Error("Statut invalide");
    err.statusCode = 400;
    throw err;
  }
  const rows = await Tenant.listForPlatform({ status, limit });
  return rows.map(serializeTenant);
}

export async function getTenant(tenantId) {
  const row = await Tenant.findForPlatform(tenantId);
  if (!row) {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  return serializeTenant(row);
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
 * Pointe le numéro Twilio vers le webhook vocal du slug, puis enregistre le numéro.
 */
export async function assignInboundNumber(tenantId, { phoneNumber, phoneNumberSid } = {}) {
  const tenant = await Tenant.findById(tenantId);
  if (!tenant || tenant.status === "closed") {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }

  const webhook = voiceWebhookUrl(tenant.slug);
  if (!webhook) {
    const err = new Error("VOICE_GATEWAY_PUBLIC_HOST ou PUBLIC_HOST manquant");
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

  const taken = await TwilioBundle.findByPhoneNumber(incoming.phoneNumber);
  if (taken && taken.tenantId !== tenantId) {
    const err = new Error("Ce numéro est déjà attribué à un autre établissement");
    err.statusCode = 409;
    throw err;
  }

  await client.incomingPhoneNumbers(incoming.sid).update({
    voiceUrl: webhook,
    voiceMethod: "POST",
  });

  await TwilioBundle.assignNumber(tenantId, {
    phoneNumber: incoming.phoneNumber,
    phoneNumberSid: incoming.sid,
    bundleSid: `manual-${tenantId}`,
  });

  await withTenant(tenantId, (db) =>
    db.query(
      `INSERT INTO tenant_settings (tenant_id, phone_line_enabled)
       VALUES ($1, TRUE)
       ON CONFLICT (tenant_id) DO UPDATE SET phone_line_enabled = TRUE`,
      [tenantId]
    )
  );

  return getTenant(tenantId);
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
  return getTenant(tenantId);
}
