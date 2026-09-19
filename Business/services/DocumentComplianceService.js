import * as OnboardingDocument from "../../models/pg/OnboardingDocument.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import * as Amenity from "../../models/pg/Amenity.js";
import { withTenant } from "../../database/transaction.js";
import { profileToWebsite } from "../mappers/websiteProfile.js";
import { documentsToWebsite } from "../mappers/websiteDocuments.js";
import { persistOnboardingDocument } from "./OnboardingDocumentStorage.js";
import {
  assertViewableWebsiteDocumentKind,
  websiteDocumentFilename,
} from "./websiteProfileTenant.js";
import { createProvisioningJob, transition } from "../../models/pg/ProvisioningJob.js";
import {
  purgeDocumentFile,
  readEncryptedDocument,
} from "../../utils/documentCrypto.js";
import {
  isTwilioBundleLocked,
} from "./TwilioProvisioningService.js";
import {
  canBypassDossierLock,
  refreshDashboardUnlock,
} from "./RestaurantDashboardAccess.js";
import * as User from "../../models/pg/User.js";
import * as Plan from "../../models/pg/Plan.js";
import * as Subscription from "../../models/pg/Subscription.js";
import { invalidateVoiceContextCache } from "../../utils/voiceContextCache.js";
import * as TwilioBundle from "../../models/pg/TwilioBundle.js";
import { parseCompanyRegistration } from "../../utils/companyRegistration.js";

const KINDS = {
  idDocumentRecto: "id_recto",
  idDocumentVerso: "id_verso",
  addressDocument: "address_proof",
};

const COUNTRIES = ["France", "Belgique", "Luxembourg"];

function sanitize(value, maxLen) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLen) {
    const err = new Error(`Champ trop long (max ${maxLen} caractères)`);
    err.statusCode = 400;
    throw err;
  }
  return text;
}

export function validateEstablishmentBody(body) {
  const profile = {
    businessName: sanitize(body.nomEtablissement || body.businessName, 200),
    addressLine: sanitize(body.adresse || body.addressLine, 300),
    postalCode: sanitize(body.codePostal || body.postalCode, 10),
    city: sanitize(body.ville || body.city, 100),
    country: sanitize(body.pays || body.country, 100),
    phone: sanitize(body.telephone || body.phone, 30),
    email: sanitize(body.email, 255),
    cuisineType: sanitize(body.typeCuisine || body.cuisineType, 100),
    phoneNumberUsage: sanitize(body.twilioNumberUsage || body.phoneNumberUsage, 2000),
  };
  if (!profile.businessName || !profile.addressLine || !profile.postalCode || !profile.city || !profile.country || !profile.phone || !profile.email) {
    const err = new Error("Champs établissement obligatoires manquants");
    err.statusCode = 400;
    throw err;
  }
  if (!COUNTRIES.includes(profile.country)) {
    const err = new Error("Pays invalide. Valeurs acceptées : France, Belgique, Luxembourg");
    err.statusCode = 400;
    throw err;
  }
  const seats = body.nombreCouverts ?? body.seatCount;
  profile.seatCount = seats == null || seats === "" ? null : parseInt(String(seats), 10);
  if (profile.seatCount != null && (Number.isNaN(profile.seatCount) || profile.seatCount < 1 || profile.seatCount > 999)) {
    const err = new Error("nombreCouverts doit être entre 1 et 999");
    err.statusCode = 400;
    throw err;
  }
  const registration = parseCompanyRegistration({
    siret: body.siret,
    siren: body.siren,
    companyNumber: body.companyNumber,
  });
  profile.siret = registration.siret;
  profile.siren = registration.siren;
  return profile;
}

export function parseOptionalBoolean(value) {
  if (value === true || value === "true" || value === "yes") return true;
  if (value === false || value === "false" || value === "no") return false;
  return null;
}

export function parseOptionalChairCount(value) {
  if (value == null || value === "") return null;
  const quantity = parseInt(String(value), 10);
  if (Number.isNaN(quantity) || quantity < 0 || quantity > 999) {
    const err = new Error("nombreChaisesBebe doit être entre 0 et 999");
    err.statusCode = 400;
    throw err;
  }
  return quantity;
}

async function persistWebsiteAmenities(tenantId, body) {
  const accessibilitePmr = parseOptionalBoolean(body.accessibilitePmr);
  const nombreChaisesBebe = parseOptionalChairCount(body.nombreChaisesBebe);
  if (accessibilitePmr === null && nombreChaisesBebe === null) return;
  await withTenant(tenantId, async (client) => {
    await Amenity.ensureDefaults(client, tenantId);
    if (accessibilitePmr !== null) {
      await Amenity.upsert(client, tenantId, {
        slug: "pmr",
        status: accessibilitePmr ? "available" : "unavailable",
      });
    }
    if (nombreChaisesBebe !== null) {
      await Amenity.upsert(client, tenantId, {
        slug: "highchair",
        status: nombreChaisesBebe > 0 ? "available" : "unavailable",
        quantity: nombreChaisesBebe,
      });
    }
  });
}

export async function loadWebsiteProfile(tenantId) {
  const documents = documentsToWebsite(
    await OnboardingDocument.listActiveByTenant(tenantId)
  );
  const profile = await EstablishmentProfile.findByTenantId(tenantId);
  if (!profile) return { documents };
  const amenities = await withTenant(tenantId, (client) =>
    Amenity.listForTenant(client, tenantId)
  );
  return {
    ...profileToWebsite(profile, amenities),
    documents,
  };
}

export async function loadWebsiteDocumentFile(tenantId, kind) {
  assertViewableWebsiteDocumentKind(kind);
  if (!tenantId) {
    const err = new Error("Établissement introuvable");
    err.statusCode = 404;
    throw err;
  }
  const record = await OnboardingDocument.findActiveByTenantAndKind(tenantId, kind);
  if (!record) {
    const err = new Error("Pièce introuvable");
    err.statusCode = 404;
    throw err;
  }
  const buffer = await loadDocumentPlain(record);
  return {
    buffer,
    mimeType: record.mimeType || "application/octet-stream",
    filename: websiteDocumentFilename(kind, record.mimeType),
  };
}

export async function saveProfile(tenantId, body) {
  const profile = validateEstablishmentBody(body);
  await EstablishmentProfile.upsert(tenantId, profile);
  await persistWebsiteAmenities(tenantId, body);
  invalidateVoiceContextCache(tenantId);
  return EstablishmentProfile.findByTenantId(tenantId);
}

export async function submitOnboardingDossier({ tenantId, userId, body, files }) {
  const profile = validateEstablishmentBody(body);
  if (!profile.phoneNumberUsage || profile.phoneNumberUsage.length < 15) {
    const err = new Error("Décrivez l'usage prévu du numéro professionnel");
    err.statusCode = 400;
    throw err;
  }
  parseCompanyRegistration(
    {
      siret: profile.siret || body.siret,
      siren: profile.siren || body.siren,
      companyNumber: body.companyNumber,
    },
    { required: true }
  );

  const existing = await EstablishmentProfile.findByTenantId(tenantId);
  const existingBundle = await TwilioBundle.findByTenantId(tenantId);
  if (existing?.documentsSubmittedAt && isTwilioBundleLocked(existingBundle)) {
    const actor = await User.findById(userId);
    const subscription = await Subscription.findCurrentByTenant(tenantId);
    const plan = subscription?.planId ? await Plan.findById(subscription.planId) : null;
    if (!canBypassDossierLock(actor, plan)) {
      const err = new Error("Le dossier a déjà été transmis");
      err.statusCode = 409;
      throw err;
    }
  }

  const required = ["idDocumentRecto", "idDocumentVerso", "addressDocument"];
  for (const field of required) {
    if (!files?.[field]?.buffer) {
      const err = new Error("Documents requis : pièce d'identité recto/verso et justificatif d'adresse");
      err.statusCode = 400;
      throw err;
    }
  }

  await EstablishmentProfile.upsert(tenantId, profile);
  await persistWebsiteAmenities(tenantId, body);

  for (const [field, kind] of Object.entries(KINDS)) {
    const file = files[field];
    if (!file?.buffer) continue;
    await persistOnboardingDocument({
      tenantId,
      userId,
      kind,
      buffer: file.buffer,
      mimeType: file.mimetype,
      filename: file.originalname,
    });
  }

  await EstablishmentProfile.markDocumentsSubmitted(tenantId);
  await createProvisioningJob(null, tenantId);
  await transition(
    tenantId,
    [
      "pending",
      "awaiting_documents",
      "bundle_submitted",
      "completed",
      "bundle_approved",
      "bundle_rejected",
    ],
    "bundle_submitted"
  );
  await refreshDashboardUnlock(userId, tenantId);

  return { message: "Dossier enregistré. Le numéro Twilio se relie depuis le back-office." };
}

export async function loadDocumentPlain(record) {
  return readEncryptedDocument({
    ciphertext: record.ciphertext,
    storagePath: record.storagePath,
    iv: record.encryptionIv,
    authTag: record.encryptionAuthTag,
  });
}

export async function purgeExpiredDocuments() {
  const expired = await OnboardingDocument.listExpired();
  for (const doc of expired) {
    await purgeDocumentFile(doc.storagePath);
    await OnboardingDocument.markPurged(doc.id);
  }
  return expired.length;
}
