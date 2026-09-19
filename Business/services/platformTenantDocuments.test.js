import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  PLATFORM_UPLOAD_DOC_KINDS,
  requireTenantForDocuments,
} from "./platformTenantDocuments.js";

describe("requireTenantForDocuments", () => {
  test("accepte un restaurant fermé encore visible au BO", () => {
    const tenant = { id: "ff3e05bf-2da5-465c-a7a2-f635021f49a9", status: "closed" };
    assert.equal(requireTenantForDocuments(tenant), tenant);
  });

  test("404 seulement si le restaurant n'existe pas", () => {
    assert.throws(() => requireTenantForDocuments(null), (err) => {
      assert.equal(err.statusCode, 404);
      return true;
    });
  });
});

describe("PLATFORM_UPLOAD_DOC_KINDS", () => {
  test("accepte les 3 pièces du dossier développeur", () => {
    assert.equal(PLATFORM_UPLOAD_DOC_KINDS.has("id_recto"), true);
    assert.equal(PLATFORM_UPLOAD_DOC_KINDS.has("id_verso"), true);
    assert.equal(PLATFORM_UPLOAD_DOC_KINDS.has("address_proof"), true);
  });
});
