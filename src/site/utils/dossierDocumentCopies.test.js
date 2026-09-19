import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { dossierCopySlots } from "./dossierDocumentCopies.js";

describe("dossierCopySlots", () => {
  test("n'affiche rien sans pieces stockees", () => {
    assert.deepEqual(dossierCopySlots(null), []);
    assert.deepEqual(dossierCopySlots([]), []);
  });

  test("expose les copies deja jointes au serveur", () => {
    const slots = dossierCopySlots([
      {
        kind: "id_recto",
        mimeType: "image/jpeg",
        byteSize: 1200,
        uploadedAt: "2026-09-19T08:00:00.000Z",
      },
    ]);
    assert.equal(slots.length, 1);
    assert.equal(slots[0].kind, "id_recto");
    assert.equal(slots[0].label, "Pièce d'identité recto");
    assert.equal(slots[0].document.byteSize, 1200);
  });
});
