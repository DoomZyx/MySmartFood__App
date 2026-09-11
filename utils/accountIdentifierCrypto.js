import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const EMPTY_SALT = Buffer.alloc(0);

// Cette clé doit rester stable ; toute rotation exige de rechiffrer les valeurs existantes.
function readMasterKey() {
  const raw = String(process.env.ACCOUNT_IDENTIFIER_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("ACCOUNT_IDENTIFIER_ENCRYPTION_KEY manquant");
  }

  const key = /^[a-f0-9]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error(
      "ACCOUNT_IDENTIFIER_ENCRYPTION_KEY doit contenir exactement 32 octets (hex 64 ou base64)"
    );
  }
  return key;
}

function deriveKey(purpose) {
  return Buffer.from(
    crypto.hkdfSync("sha256", readMasterKey(), EMPTY_SALT, `account-google-id:${purpose}`, KEY_BYTES)
  );
}

function normalizeGoogleId(googleId) {
  const normalized = String(googleId || "").trim();
  if (!normalized) {
    throw new Error("googleId manquant");
  }
  return normalized;
}

export function hashGoogleId(googleId) {
  return crypto
    .createHmac("sha256", deriveKey("lookup"))
    .update(normalizeGoogleId(googleId), "utf8")
    .digest("hex");
}

export function encryptGoogleId(googleId) {
  const normalized = normalizeGoogleId(googleId);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey("encryption"), iv);
  const ciphertext = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    authTag.toString("base64url"),
  ].join(":");
}

export function decryptGoogleId(encryptedGoogleId) {
  const parts = String(encryptedGoogleId || "").split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Format de google_id chiffré invalide");
  }

  const [, ivRaw, ciphertextRaw, authTagRaw] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey("encryption"),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
