import twilio from "twilio";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as OnboardingDocument from "../../models/pg/OnboardingDocument.js";
import * as Tenant from "../../models/pg/Tenant.js";
import { transition } from "../../models/pg/ProvisioningJob.js";
import { readEncryptedDocument } from "../../utils/documentCrypto.js";
import { withTenant } from "../../database/transaction.js";
import logger from "../../Services/logging/logger.js";

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

export function validateTwilioSignature(url, params, signature) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  return twilio.validateRequest(token, signature, url, params || {});
}

/**
 * Crée ou reprend le bundle réglementaire Twilio.
 * Les documents sont déchiffrés en mémoire uniquement, jamais renvoyés par e-mail.
 */
export async function submitRegulatoryBundle(tenantId) {
  const profile = await EstablishmentProfile.findByTenantId(tenantId);
  if (!profile) {
    throw new Error("Profil établissement manquant");
  }

  const client = twilioClient();
  const isoCountry = profile.country === "Belgique" ? "BE" : profile.country === "Luxembourg" ? "LU" : "FR";
  const bundle = await client.numbers.v2.regulatoryCompliance.bundles.create({
    friendlyName: `tenant-${tenantId}`,
    email: profile.email,
    statusCallback: `${process.env.PUBLIC_HOST || ""}/api/twilio/bundle-status`.replace(/([^:]\/)\/+/g, "$1"),
    isoCountry,
    numberType: "local",
    endUserType: "business",
  });

  await TwilioBundle.upsertBundle({
    tenantId,
    bundleSid: bundle.sid,
    status: bundle.status || "pending-review",
  });

  const docs = await OnboardingDocument.listActiveByTenant(tenantId);
  for (const doc of docs) {
    const plain = await readEncryptedDocument({
      storagePath: doc.storagePath,
      iv: doc.encryptionIv,
      authTag: doc.encryptionAuthTag,
    });
    await client.numbers.v2.regulatoryCompliance.supportingDocuments.create({
      friendlyName: `${doc.kind}-${tenantId}`,
      type: doc.kind === "kbis" ? "business_registration" : "government_issued_document",
      attributes: {
        bundle_sid: bundle.sid,
        mime_type: doc.mimeType,
      },
    });
    // Le contenu binaire n'est pas journalisé. Twilio reçoit une référence de bundle.
    void plain.length;
  }

  await client.numbers.v2.regulatoryCompliance.bundles(bundle.sid).update({
    status: "pending-review",
  });
  logger.info({ tenantId, bundleSid: bundle.sid }, "Bundle Twilio soumis");
}

export async function handleBundleStatusWebhook({ bundleSid, status, failureReason }) {
  const bundle = await TwilioBundle.findByBundleSid(bundleSid);
  if (!bundle) {
    logger.warn({ bundleSid }, "Bundle Twilio inconnu");
    return { ignored: true };
  }

  await TwilioBundle.updateStatus(bundleSid, status, { failureReason });

  if (status === "twilio-rejected") {
    await transition(bundle.tenantId, ["bundle_submitted"], "bundle_rejected", {
      lastError: failureReason || "Bundle rejeté",
    });
    return { rejected: true };
  }

  if (status !== "twilio-approved") {
    return { pending: true };
  }

  await transition(bundle.tenantId, ["bundle_submitted"], "bundle_approved");
  await purchaseLocalNumber(bundle.tenantId, bundleSid);
  return { activated: true };
}

async function purchaseLocalNumber(tenantId, bundleSid) {
  const tenant = await Tenant.findById(tenantId);
  const client = twilioClient();
  const country = tenant?.countryCode || "FR";
  const available = await client.availablePhoneNumbers(country).local.list({ limit: 1 });
  if (!available[0]) {
    await transition(tenantId, ["bundle_approved"], "failed", {
      lastError: "Aucun numéro local disponible",
    });
    return;
  }

  const purchased = await client.incomingPhoneNumbers.create({
    phoneNumber: available[0].phoneNumber,
    bundleSid,
    voiceUrl: `${(process.env.VOICE_GATEWAY_PUBLIC_HOST || process.env.PUBLIC_HOST || "").replace(/\/$/, "")}/twilio/${tenant.slug}/incoming-call`,
    voiceMethod: "POST",
  });

  await TwilioBundle.updateStatus(bundleSid, "twilio-approved", {
    phoneNumber: purchased.phoneNumber,
    phoneNumberSid: purchased.sid,
  });
  await transition(tenantId, ["bundle_approved", "number_purchased"], "completed");
  await Tenant.updateStatus(null, tenantId, "active");
  await withTenant(tenantId, (db) =>
    db.query(
      `UPDATE tenant_settings
          SET phone_line_enabled = TRUE
        WHERE tenant_id = $1`,
      [tenantId],
    ),
  );
  logger.info({ tenantId, phoneNumber: purchased.phoneNumber }, "Numéro local attribué, tenant actif");
}
