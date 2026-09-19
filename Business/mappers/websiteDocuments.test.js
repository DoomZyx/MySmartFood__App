import { documentsToWebsite } from "./websiteDocuments.js";

describe("documentsToWebsite", () => {
  test("expose les metadonnees des pieces actives", () => {
    const dto = documentsToWebsite([
      {
        kind: "id_recto",
        mimeType: "image/jpeg",
        byteSize: 2048,
        createdAt: "2026-09-19T08:00:00.000Z",
        purgedAt: null,
      },
    ]);
    expect(dto).toEqual([
      {
        kind: "id_recto",
        mimeType: "image/jpeg",
        byteSize: 2048,
        uploadedAt: "2026-09-19T08:00:00.000Z",
      },
    ]);
  });

  test("ignore les pieces purgees et les entrees sans kind", () => {
    const dto = documentsToWebsite([
      { kind: "id_verso", mimeType: "application/pdf", byteSize: 10, purgedAt: "2026-09-18" },
      { mimeType: "image/png", byteSize: 12 },
      null,
    ]);
    expect(dto).toEqual([]);
  });

  test("retourne un tableau vide si la source est absente", () => {
    expect(documentsToWebsite()).toEqual([]);
    expect(documentsToWebsite(null)).toEqual([]);
  });
});
