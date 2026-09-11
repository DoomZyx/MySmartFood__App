import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ALGO = "aes-256-gcm";

function getKey() {
  const raw = process.env.DOCUMENT_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") {
    throw new Error("DOCUMENT_ENCRYPTION_KEY manquant");
  }
  const key = raw.length === 64 && /^[0-9a-f]+$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("DOCUMENT_ENCRYPTION_KEY doit faire 32 octets (hex 64 ou base64)");
  }
  return key;
}

export function encryptBuffer(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext,
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    sha256: crypto.createHash("sha256").update(plain).digest("hex"),
  };
}

export function decryptBuffer({ ciphertext, iv, authTag }) {
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function documentsRoot() {
  return process.env.DOCUMENT_STORAGE_DIR || path.join(process.cwd(), "uploads", "onboarding-encrypted");
}

export async function writeEncryptedDocument(tenantId, kind, buffer) {
  const encrypted = encryptBuffer(buffer);
  const dir = path.join(documentsRoot(), tenantId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const filename = `${kind}.bin`;
  const storagePath = path.join(dir, filename);
  await fs.writeFile(storagePath, encrypted.ciphertext, { mode: 0o600 });
  return {
    storagePath,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    sha256: encrypted.sha256,
    byteSize: buffer.length,
  };
}

export async function readEncryptedDocument({ storagePath, iv, authTag }) {
  const ciphertext = await fs.readFile(storagePath);
  return decryptBuffer({ ciphertext, iv, authTag });
}

export async function purgeDocumentFile(storagePath) {
  await fs.unlink(storagePath).catch(() => {});
}
