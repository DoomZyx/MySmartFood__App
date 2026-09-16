import twilio from "twilio";
import * as Tenant from "../../models/pg/Tenant.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as User from "../../models/pg/User.js";
import { markCompleted, markRejected } from "../../models/pg/ProvisioningJob.js";
import * as Contact from "../../models/pg/Contact.js";
import * as Demo from "../../models/pg/Demo.js";
import { withTenant } from "../../database/transaction.js";
import {
  incomingNumberVoiceUpdate,
  resolveVoicePublicHost,
  voiceWebhookSlug,
  voiceWebhookUrl,
} from "../../utils/voiceWebhookUrl.js";

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

function serializeTenant(row, publicHost) {
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
    bundleStatus: row.bundleStatus || null,
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
