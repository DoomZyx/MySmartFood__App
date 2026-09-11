import * as OnboardingDocument from "../../models/pg/OnboardingDocument.js";
import * as EstablishmentProfile from "../../models/pg/EstablishmentProfile.js";
import { transition } from "../../models/pg/ProvisioningJob.js";
import {
  purgeDocumentFile,
  readEncryptedDocument,
  writeEncryptedDocument,
} from "../../utils/documentCrypto.js";
import { submitRegulatoryBundle } from "./TwilioProvisioningService.js";

const KINDS = {
  kbisDocument: "kbis",
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
  return profile;
}

export async function saveProfile(tenantId, body) {
  const profile = validateEstablishmentBody(body);
  await EstablishmentProfile.upsert(tenantId, profile);
  return EstablishmentProfile.findByTenantId(tenantId);
}

export async function submitOnboardingDossier({ tenantId, userId, body, files }) {
  const profile = validateEstablishmentBody(body);
  if (!profile.phoneNumberUsage || profile.phoneNumberUsage.length < 15) {
    const err = new Error("Décrivez l'usage prévu du numéro professionnel");
    err.statusCode = 400;
    throw err;
  }

  const existing = await EstablishmentProfile.findByTenantId(tenantId);
  if (existing?.documentsSubmittedAt) {
    const err = new Error("Le dossier a déjà été transmis");
    err.statusCode = 409;
    throw err;
  }

  const required = ["kbisDocument", "idDocumentRecto", "idDocumentVerso", "addressDocument"];
  for (const field of required) {
    if (!files?.[field]?.buffer) {
      const err = new Error("Documents requis : KBIS, pièce d'identité recto/verso, justificatif d'adresse");
      err.statusCode = 400;
      throw err;
    }
  }

  await EstablishmentProfile.upsert(tenantId, profile);

  const retentionDays = Number(process.env.DOCUMENT_RETENTION_DAYS) || 90;
  const retentionUntil = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

  for (const [field, kind] of Object.entries(KINDS)) {
    const file = files[field];
    const stored = await writeEncryptedDocument(tenantId, kind, file.buffer);
    await OnboardingDocument.upsertEncrypted({
      tenantId,
      uploadedByUserId: userId,
      kind,
      storagePath: stored.storagePath,
      mimeType: file.mimetype,
      byteSize: stored.byteSize,
      contentSha256: stored.sha256,
      encryptionIv: stored.iv,
      encryptionAuthTag: stored.authTag,
      retentionUntil,
    });
  }

  await EstablishmentProfile.markDocumentsSubmitted(tenantId);
  await transition(tenantId, ["pending", "awaiting_documents"], "bundle_submitted");
  await submitRegulatoryBundle(tenantId);

  return { message: "Dossier chiffré et transmis pour conformité Twilio" };
}

export async function loadDocumentPlain(record) {
  return readEncryptedDocument({
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
