function replaceExt(name, ext) {
  const base = String(name || "photo").replace(/\.[^.]+$/, "");
  return `${base}.${ext}`;
}

export const PHOTO_ACCEPT =
  ".pdf,.heif,.heic,.hif,image/jpeg,image/png,image/jpg,image/webp,image/heif,image/heic";

export const PHOTO_MAX_MB = 20;

export function isHeifFile(file) {
  if (!file) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return (
    type.includes("heif") ||
    type.includes("heic") ||
    /\.(heif|heic|hif)$/.test(name)
  );
}

export async function fileToWebp(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  if (!file) return file;
  const type = String(file.type || "").toLowerCase();
  if (type.includes("pdf")) return file;
  // Chrome/Firefox ne décodent souvent pas le HEIF : createImageBitmap
  // peut rester bloqué et le fichier n'est jamais attaché. Le serveur convertit.
  if (isHeifFile(file)) return file;
  if (type && !type.startsWith("image/")) {
    return file;
  }
  if (typeof createImageBitmap !== "function") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    if (typeof bitmap.close === "function") bitmap.close();
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error("webp"))),
        "image/webp",
        quality
      );
    });
    return new File([blob], replaceExt(file.name, "webp"), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
