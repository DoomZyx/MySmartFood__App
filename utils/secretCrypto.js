import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const EMPTY_SALT = Buffer.alloc(0);

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
    crypto.hkdfSync("sha256", readMasterKey(), EMPTY_SALT, purpose, KEY_BYTES)
  );
}

export function encryptSecret(plain, purpose) {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(purpose), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64url"),
    ciphertext.toString("base64url"),
    authTag.toString("base64url"),
  ].join(":");
}

export function decryptSecret(encrypted, purpose) {
  const parts = String(encrypted || "").split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error("Secret chiffré invalide");
  }
  const [, ivRaw, ciphertextRaw, authTagRaw] = parts;
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey(purpose),
    Buffer.from(ivRaw, "base64url")
  );
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
