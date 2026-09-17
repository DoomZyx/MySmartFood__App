import { compressToWebp, isHeifSource, toTwilioUpload } from "./imageWebp.js";

describe("compressToWebp", () => {
  test("laisse un PDF intact", async () => {
    const buffer = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("x")]);
    const result = await compressToWebp(buffer, "application/pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.buffer.equals(buffer)).toBe(true);
  });

  test("détecte un .heif même en octet-stream", () => {
    const header = Buffer.alloc(24);
    header.writeUInt32BE(24, 0);
    header.write("ftyp", 4, "ascii");
    header.write("mif1", 8, "ascii");
    header.write("heif", 16, "ascii");
    expect(isHeifSource(header, "application/octet-stream", "carte.heif")).toBe(true);
    expect(isHeifSource(header, "image/heif", "")).toBe(true);
    expect(isHeifSource(Buffer.from("not-heif"), "image/jpeg", "id.jpg")).toBe(false);
  });

  test("refuse un HEIF illisible", async () => {
    await expect(
      compressToWebp(Buffer.from("not-a-heif"), "image/heif", "id.heif")
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("laisse un PDF tel quel pour l'upload Twilio", async () => {
    const buffer = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("x")]);
    const result = await toTwilioUpload(buffer, "application/pdf", "kbis.pdf");
    expect(result.mimeType).toBe("application/pdf");
    expect(result.filename).toBe("kbis.pdf");
    expect(result.buffer.equals(buffer)).toBe(true);
  });
});
