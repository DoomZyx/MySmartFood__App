import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isDossierAwaitingReview,
  mergeRestaurants,
  restaurantStage,
} from "./platformOpsLanes.js";

describe("isDossierAwaitingReview", () => {
  test("un tenant actif avec pièces envoyées reste à traiter", () => {
    assert.equal(
      isDossierAwaitingReview({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "bundle_submitted",
      }),
      true
    );
  });

  test("un tenant actif sans job de provisioning reste à traiter", () => {
    assert.equal(
      isDossierAwaitingReview({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: null,
      }),
      true
    );
  });

  test("un dossier déjà validé sort de la file", () => {
    assert.equal(
      isDossierAwaitingReview({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "completed",
      }),
      false
    );
  });

  test("un restaurant fermé avec pièces non traitées reste à traiter", () => {
    assert.equal(
      isDossierAwaitingReview({
        status: "closed",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "bundle_submitted",
      }),
      true
    );
  });
});

describe("restaurantStage", () => {
  test("classe un restaurant développeur actif dans la file à valider", () => {
    assert.equal(
      restaurantStage({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "bundle_submitted",
        checklist: { ready: true },
      }),
      "ready"
    );
    assert.equal(
      restaurantStage({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: null,
        checklist: { ready: false },
      }),
      "pending_compliance"
    );
  });

  test("classe un restaurant fermé avec pièces dans la file à valider", () => {
    assert.equal(
      restaurantStage({
        status: "closed",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "bundle_submitted",
        checklist: { ready: false },
      }),
      "pending_compliance"
    );
  });

  test("laisse un restaurant actif déjà traité dans la flotte", () => {
    assert.equal(
      restaurantStage({
        status: "active",
        documentsSubmittedAt: "2026-09-19",
        provisioningState: "completed",
      }),
      "active"
    );
  });
});

describe("mergeRestaurants", () => {
  test("ne remplace pas des pièces déjà chargées par une fiche sans documents", () => {
    const withDocs = {
      id: "tenant-1",
      status: "closed",
      documents: [{ kind: "id_recto" }, { kind: "id_verso" }],
      documentKinds: ["id_recto", "id_verso"],
    };
    const stub = { id: "tenant-1", status: "closed" };
    const merged = mergeRestaurants([withDocs], [], [stub]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0].documents.length, 2);
    assert.deepEqual(merged[0].documentKinds, ["id_recto", "id_verso"]);
  });

  test("garde le restaurant actif si une fiche fermée périmée arrive ensuite", () => {
    const active = {
      id: "tenant-1",
      status: "active",
      documents: [{ kind: "id_recto" }],
    };
    const closed = {
      id: "tenant-1",
      status: "closed",
      documents: [{ kind: "id_recto" }],
    };
    const merged = mergeRestaurants([], [active], [closed]);
    assert.equal(merged[0].status, "active");
    assert.equal(merged[0].documents.length, 1);
  });
});
