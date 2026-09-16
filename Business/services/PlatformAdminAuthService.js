import crypto from "node:crypto";
import QRCode from "qrcode";
import * as User from "../../models/pg/User.js";
import { decryptSecret, encryptSecret } from "../../utils/secretCrypto.js";
import { generateTotpSecret, totpOtpauthUri, verifyTotp } from "../../utils/totp.js";

const GENERIC_DENIED = "Identifiants ou code d'accès incorrects";
const TOTP_PURPOSE = "platform-totp";

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value ?? "")).digest();
}

function safeEqual(left, right) {
  return crypto.timingSafeEqual(hashValue(left), hashValue(right));
}

function configuredAccessCode() {
  return String(process.env.PLATFORM_ADMIN_ACCESS_CODE || "").trim();
}

function denied(message = GENERIC_DENIED, statusCode = 401) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

export async function totpStepFor(userId) {
  const totp = await User.findPlatformTotp(userId);
  return totp?.enabledAt ? "verify" : "enroll";
}

export async function loginPlatformAdmin({ email, password, accessCode }) {
  const expectedCode = configuredAccessCode();
  if (expectedCode.length < 8) {
    denied("Back-office non configuré", 503);
  }

  const emailNorm = String(email || "").trim().toLowerCase();
  const user = await User.findByEmail(emailNorm);
  const passwordOk = user ? await User.verifyPassword(user.id, password) : false;
  const codeOk = safeEqual(accessCode, expectedCode);
  const adminOk = Boolean(user?.isPlatformAdmin);

  if (!user || !passwordOk || !codeOk || !adminOk) {
    denied();
  }

  await User.touchLastLogin(user.id);
  const totpStep = await totpStepFor(user.id);
  return { user, totpStep };
}

export async function startPlatformOAuthChallenge(user) {
  if (!user?.isPlatformAdmin) {
    denied("Accès refusé", 403);
  }
  await User.touchLastLogin(user.id);
  return totpStepFor(user.id);
}

async function totpEnrollmentPayload(secret, email) {
  const qrDataUrl = await QRCode.toDataURL(totpOtpauthUri(secret, email), {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
  return { qrDataUrl };
}

export async function setupPlatformTotp(user) {
  const current = await User.findPlatformTotp(user.id);
  if (current?.enabledAt) {
    denied("L'authenticator est déjà configuré", 409);
  }
  if (current?.secret) {
    return totpEnrollmentPayload(decryptSecret(current.secret, TOTP_PURPOSE), user.email);
  }
  const secret = generateTotpSecret();
  await User.savePlatformTotpSecret(user.id, encryptSecret(secret, TOTP_PURPOSE));
  return totpEnrollmentPayload(secret, user.email);
}

export async function confirmPlatformTotp(user, token) {
  const current = await User.findPlatformTotp(user.id);
  if (!current?.secret || current.enabledAt) {
    denied("Enrollement 2FA invalide", 409);
  }
  const secret = decryptSecret(current.secret, TOTP_PURPOSE);
  const checked = verifyTotp(secret, token);
  if (!checked.ok) {
    denied("Code authenticator invalide");
  }
  await User.enablePlatformTotp(user.id, checked.step);
  return user;
}

export async function verifyPlatformTotp(user, token) {
  const current = await User.findPlatformTotp(user.id);
  if (!current?.secret || !current.enabledAt) {
    denied("Authenticator non configuré", 409);
  }
  const secret = decryptSecret(current.secret, TOTP_PURPOSE);
  const checked = verifyTotp(secret, token, current.lastStep);
  if (!checked.ok) {
    denied("Code authenticator invalide");
  }
  await User.touchPlatformTotpStep(user.id, checked.step);
  return user;
}
