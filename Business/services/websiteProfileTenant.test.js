import {
  assertViewableWebsiteDocumentKind,
  resolveWebsiteProfileTenantId,
  websiteDocumentFilename,
} from "./websiteProfileTenant.js";

describe("resolveWebsiteProfileTenantId", () => {
  test("priorise l'etablissement impersonne", () => {
    expect(
      resolveWebsiteProfileTenantId({
        impersonationTenantId: "tenant-imp",
        firstTenantId: "tenant-own",
      })
    ).toBe("tenant-imp");
  });

  test("reprend le premier etablissement du compte", () => {
    expect(
      resolveWebsiteProfileTenantId({
        impersonationTenantId: null,
        firstTenantId: "tenant-own",
      })
    ).toBe("tenant-own");
  });

  test("retourne null sans etablissement", () => {
    expect(resolveWebsiteProfileTenantId({})).toBeNull();
  });
});

describe("assertViewableWebsiteDocumentKind", () => {
  test("accepte les pieces du dossier", () => {
    expect(assertViewableWebsiteDocumentKind("id_recto")).toBe("id_recto");
    expect(assertViewableWebsiteDocumentKind("id_verso")).toBe("id_verso");
    expect(assertViewableWebsiteDocumentKind("address_proof")).toBe("address_proof");
  });

  test("refuse un type inconnu", () => {
    try {
      assertViewableWebsiteDocumentKind("passport");
      throw new Error("devait lever une erreur");
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe("Type de pièce invalide");
    }
  });
});

describe("websiteDocumentFilename", () => {
  test("derive l'extension depuis le mime", () => {
    expect(websiteDocumentFilename("id_recto", "application/pdf")).toBe("id_recto.pdf");
    expect(websiteDocumentFilename("id_verso", "image/png")).toBe("id_verso.png");
    expect(websiteDocumentFilename("address_proof", "image/jpeg")).toBe("address_proof.jpg");
  });
});
