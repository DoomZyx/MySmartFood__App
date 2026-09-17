import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const require = createRequire(import.meta.url);
const heicConvert = require("heic-convert");

const MAX_EDGE = 1600;
const WEBP_QUALITY = "80";
/** Taille max du fichier source (HEIF iPhone souvent > 5 Mo) avant conversion WebP. */
export const MAX_SOURCE_UPLOAD_BYTES = 20 * 1024 * 1024;
const PDF_MAGIC = Buffer.from("%PDF");
const HEIF_BRANDS = new Set(["heic", "heix", "heif", "heim", "heis", "hevc", "hevx"]);

function looksLikePdf(buffer, mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("pdf")) return true;
  return buffer?.length >= 4 && buffer.subarray(0, 4).equals(PDF_MAGIC);
}

export function isHeifSource(buffer, mimeType = "", filename = "") {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(filename || "").toLowerCase();
  if (mime.includes("heif") || mime.includes("heic")) return true;
  if (/\.(heif|heic|hif)$/.test(name)) return true;
  if (!buffer || buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const major = buffer.toString("ascii", 8, 12).replace(/\0/g, "").toLowerCase();
  if (HEIF_BRANDS.has(major)) return true;
  for (let offset = 16; offset + 4 <= Math.min(buffer.length, 256); offset += 4) {
    const brand = buffer.toString("ascii", offset, offset + 4).replace(/\0/g, "").toLowerCase();
    if (HEIF_BRANDS.has(brand)) return true;
  }
  return false;
}

function looksLikeRaster(mimeType, filename) {
  const mime = String(mimeType || "").toLowerCase();
  const name = String(filename || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  if (/\.(jpe?g|png|webp|gif|bmp|tiff?)$/.test(name)) return true;
  return isHeifSource(null, mimeType, filename);
}

function replaceExt(name, ext) {
  const base = String(name || "document").replace(/\.[^.]+$/, "") || "document";
  return `${base}.${ext}`;
}

function runFfmpeg(input, output, extraArgs) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg-static introuvable"));
      return;
    }
    const codecArgs = extraArgs || [
      "-vf",
      `scale='min(${MAX_EDGE},iw)':-2`,
      "-c:v",
      "libwebp",
      "-quality",
      WEBP_QUALITY,
    ];
    const proc = spawn(
      ffmpegPath,
      ["-y", "-i", input, ...codecArgs, output],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `ffmpeg exit ${code}`));
    });
  });
}

async function heifToJpeg(buffer) {
  const jpeg = await heicConvert({
    buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
    format: "JPEG",
    quality: 0.9,
  });
  return Buffer.from(jpeg);
}

async function rasterToWebp(buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "msf-webp-"));
  const input = path.join(dir, "in.bin");
  const output = path.join(dir, "out.webp");
  try {
    await fs.writeFile(input, buffer);
    await runFfmpeg(input, output);
    const webp = await fs.readFile(output);
    if (!webp.length) return null;
    return webp;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function compressToWebp(buffer, mimeType = "", filename = "") {
  if (!buffer?.length) {
    const err = new Error("Fichier vide");
    err.statusCode = 400;
    throw err;
  }
  if (looksLikePdf(buffer, mimeType)) {
    return { buffer, mimeType: "application/pdf" };
  }

  let source = buffer;
  let sourceMime = mimeType;

  if (isHeifSource(buffer, mimeType, filename)) {
    try {
      source = await heifToJpeg(buffer);
      sourceMime = "image/jpeg";
    } catch {
      const err = new Error("Fichier HEIF illisible. Envoyez un JPEG, PNG, WebP ou HEIF valide.");
      err.statusCode = 400;
      throw err;
    }
  } else if (!looksLikeRaster(mimeType, filename) && String(mimeType || "")) {
    return { buffer, mimeType };
  }

  try {
    const webp = await rasterToWebp(source);
    if (webp) return { buffer: webp, mimeType: "image/webp" };
  } catch {
    // conserve le JPEG issu du HEIF si le passage WebP échoue
  }
  return { buffer: source, mimeType: sourceMime || "application/octet-stream" };
}

const TWILIO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

async function rasterToJpeg(buffer) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "msf-jpeg-"));
  const input = path.join(dir, "in.bin");
  const output = path.join(dir, "out.jpg");
  try {
    await fs.writeFile(input, buffer);
    await runFfmpeg(input, output, [
      "-vf",
      `scale='min(${MAX_EDGE},iw)':-2`,
      "-q:v",
      "4",
    ]);
    const jpeg = await fs.readFile(output);
    if (!jpeg.length) return null;
    return jpeg;
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Twilio n'accepte que JPEG, PNG ou PDF, max 5 Mo. */
export async function toTwilioUpload(buffer, mimeType = "", filename = "") {
  if (!buffer?.length) {
    const err = new Error("Fichier vide");
    err.statusCode = 400;
    throw err;
  }
  if (looksLikePdf(buffer, mimeType)) {
    if (buffer.length > TWILIO_UPLOAD_MAX_BYTES) {
      const err = new Error("PDF trop volumineux pour Twilio (max 5 Mo)");
      err.statusCode = 400;
      throw err;
    }
    return {
      buffer,
      mimeType: "application/pdf",
      filename: replaceExt(filename, "pdf"),
    };
  }
  const mime = String(mimeType || "").toLowerCase();
  const name = String(filename || "").toLowerCase();
  if (
    (mime.includes("png") || name.endsWith(".png")) &&
    buffer.length <= TWILIO_UPLOAD_MAX_BYTES
  ) {
    return {
      buffer,
      mimeType: "image/png",
      filename: replaceExt(filename, "png"),
    };
  }
  const alreadyJpeg =
    mime.includes("jpeg") ||
    mime.includes("jpg") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg");
  let jpeg = alreadyJpeg && buffer.length <= TWILIO_UPLOAD_MAX_BYTES ? buffer : null;
  if (!jpeg) {
    jpeg = await rasterToJpeg(buffer);
  }
  if (!jpeg?.length || jpeg.length > TWILIO_UPLOAD_MAX_BYTES) {
    const err = new Error("Image trop volumineuse pour Twilio (max 5 Mo, JPEG/PNG/PDF)");
    err.statusCode = 400;
    throw err;
  }
  return {
    buffer: jpeg,
    mimeType: "image/jpeg",
    filename: replaceExt(filename, "jpg"),
  };
}
