import twilio from "twilio";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as OnboardingDocument from "../../models/pg/OnboardingDocument.js";
import * as Tenant from "../../models/pg/Tenant.js";
import * as User from "../../models/pg/User.js";
import { transition } from "../../models/pg/ProvisioningJob.js";
import { readEncryptedDocument } from "../../utils/documentCrypto.js";
import { toTwilioUpload } from "../../utils/imageWebp.js";
import logger from "../../Services/logging/logger.js";

const LOCKED_BUNDLE_STATUSES = new Set([
  "pending-review",
  "in-review",
  "twilio-approved",
  "twilio-rejected",
  "approved",
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

export function validateTwilioSignature(url, params, signature) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  return twilio.validateRequest(token, signature, url, params || {});
}

export function isTwilioBundleLocked(bundle) {
  return LOCKED_BUNDLE_STATUSES.has(String(bundle?.status || "").toLowerCase());
}

export function isoCountryFromProfile(country) {
  if (country === "Belgique") return "BE";
  if (country === "Luxembourg") return "LU";
  return "FR";
}

export function splitPersonName(fullName) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function twilioEndUserAttributes(isoCountry, profile, person, website) {
  const registration = profile.siret || profile.siren || "";
  if (isoCountry === "BE") {
    return { business_name: profile.businessName, vat: registration };
  }
  if (isoCountry === "LU") {
    return { business_name: profile.businessName };
  }
  return {
    business_name: profile.businessName,
    business_registration_number: registration,
    business_website: website,
    first_name: person.firstName,
    last_name: person.lastName,
    email: profile.email,
  };
}

export function twilioSupportingDocumentForKind(kind, ctx) {
  const addressSids = ctx.addressSid ? [ctx.addressSid] : [];
  if (kind === "kbis") {
    return {
      type: "commercial_registrar_excerpt",
      attributes: {
        business_name: ctx.businessName,
        business_registration_number: ctx.registrationNumber,
        first_name: ctx.firstName,
        last_name: ctx.lastName,
        address_sids: addressSids,
      },
    };
  }
  if (kind === "address_proof") {
    return {
      type: "utility_bill",
      attributes: { address_sids: addressSids },
    };
  }
  if (kind === "id_recto" || kind === "id_verso") {
    return {
      type: "government_issued_document",
      attributes: {
        first_name: ctx.firstName,
        last_name: ctx.lastName,
        business_name: ctx.businessName,
      },
    };
  }
  return null;
}

function publicSiteUrl() {
  const host = String(process.env.PUBLIC_HOST || "https://www.mysmartfood.fr").replace(/\/+$/, "");
  if (!host) return "https://www.mysmartfood.fr";
  return host.startsWith("http") ? host : `https://${host}`;
}

function wrapTwilioError(err) {
  if (err?.statusCode) return err;
  const message = err?.message || "Erreur Twilio";
  const wrapped = new Error(message);
  wrapped.statusCode = err?.status >= 400 && err.status < 500 ? err.status : 502;
  return wrapped;
}

async function createSupportingDocumentWithFile({
  accountSid,
  authToken,
  friendlyName,
  type,
  attributes,
  file,
}) {
  const form = new FormData();
  form.append("FriendlyName", friendlyName);
  form.append("Type", type);
  form.append("Attributes", JSON.stringify(attributes || {}));
  form.append(
    "File",
    new Blob([new Uint8Array(file.buffer)], { type: file.mimeType }),
    file.filename
  );
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(
    "https://numbers-upload.twilio.com/v2/RegulatoryCompliance/SupportingDocuments",
    {
      method: "POST",
      headers: { Authorization: `Basic ${auth}` },
      body: form,
    }
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.sid) {
    const err = new Error(
      body.message || `Twilio a refusé le document ${type} (${response.status})`
    );
    err.status = response.status;
    throw err;
  }
  return body;
}

async function createBundle(client, tenantId, profile, isoCountry) {
  const statusCallback = `${process.env.PUBLIC_HOST || ""}/api/twilio/bundle-status`.replace(
    /([^:]\/)\/+/g,
    "$1"
  );
  return client.numbers.v2.regulatoryCompliance.bundles.create({
    friendlyName: `tenant-${tenantId}`,
    email: profile.email,
    statusCallback,
    isoCountry,
    numberType: "local",
    endUserType: "business",
  });
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

  const tenant = await Tenant.findById(tenantId);
  const owner = tenant?.ownerUserId ? await User.findById(tenant.ownerUserId) : null;
  const person = splitPersonName(owner?.name);
  if (!person.firstName || !person.lastName) {
    const err = new Error(
      "Le nom du dirigeant (prénom et nom) est requis pour le dossier Twilio"
    );
    err.statusCode = 400;
    throw err;
  }

  const isoCountry = isoCountryFromProfile(profile.country);
  const registrationNumber = profile.siret || profile.siren || "";
  const client = twilioClient();
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  try {
    const address = await client.addresses.create({
      customerName: profile.businessName,
      street: profile.addressLine,
      city: profile.city,
      region: profile.city,
      postalCode: profile.postalCode,
      isoCountry,
    });

    const endUser = await client.numbers.v2.regulatoryCompliance.endUsers.create({
      friendlyName: `business-${tenantId}`,
      type: "business",
      attributes: twilioEndUserAttributes(
        isoCountry,
        profile,
        person,
        publicSiteUrl()
      ),
    });

    const bundle = await createBundle(client, tenantId, profile, isoCountry);

    await TwilioBundle.upsertBundle({
      tenantId,
      bundleSid: bundle.sid,
      status: bundle.status || "draft",
      endUserSid: endUser.sid,
    });

    const docs = await OnboardingDocument.listActiveByTenant(tenantId);
    const objectSids = [endUser.sid];
    const docCtx = {
      firstName: person.firstName,
      lastName: person.lastName,
      businessName: profile.businessName,
      registrationNumber,
      addressSid: address.sid,
    };

    for (const doc of docs) {
      const spec = twilioSupportingDocumentForKind(doc.kind, docCtx);
      if (!spec) continue;
      const plain = await readEncryptedDocument({
        ciphertext: doc.ciphertext,
        storagePath: doc.storagePath,
        iv: doc.encryptionIv,
        authTag: doc.encryptionAuthTag,
      });
      const file = await toTwilioUpload(plain, doc.mimeType, `${doc.kind}`);
      const created = await createSupportingDocumentWithFile({
        accountSid,
        authToken,
        friendlyName: `${doc.kind}-${tenantId}`,
        type: spec.type,
        attributes: spec.attributes,
        file,
      });
      objectSids.push(created.sid);
    }

    for (const objectSid of objectSids) {
      await client.numbers.v2.regulatoryCompliance
        .bundles(bundle.sid)
        .itemAssignments.create({ objectSid });
    }

    await client.numbers.v2.regulatoryCompliance.bundles(bundle.sid).update({
      status: "pending-review",
    });
    await TwilioBundle.updateStatus(bundle.sid, "pending-review");
    logger.info({ tenantId, bundleSid: bundle.sid }, "Bundle Twilio soumis");
  } catch (err) {
    throw wrapTwilioError(err);
  }
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
  logger.info({ tenantId: bundle.tenantId, bundleSid }, "Bundle Twilio approuvé, numéro à relier manuellement");
  return { approved: true };
}
