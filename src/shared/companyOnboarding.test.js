import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  canOpenCompanyDossierForm,
  canResumeCompanyDossier,
  isDeveloperUser,
} from "./companyOnboarding.js";

describe("canOpenCompanyDossierForm", () => {
  test("refuse un visiteur", () => {
    assert.equal(canOpenCompanyDossierForm(null), false);
  });

  test("autorise un développeur même après envoi du dossier", () => {
    const user = {
      planSlug: "developpeur",
      twilioDocsSubmittedAt: "2026-09-01",
      accessUnlocked: true,
    };
    assert.equal(isDeveloperUser(user), true);
    assert.equal(canOpenCompanyDossierForm(user), true);
  });

  test("autorise le propriétaire plateforme même après envoi du dossier", () => {
    const user = {
      isPlatformOwner: true,
      twilioDocsSubmittedAt: "2026-09-01",
      accessUnlocked: true,
    };
    assert.equal(canOpenCompanyDossierForm(user), true);
  });

  test("autorise un client tant que le dossier n'est pas transmis", () => {
    assert.equal(
      canOpenCompanyDossierForm({ planSlug: "beta", twilioDocsSubmittedAt: null }),
      true
    );
  });

  test("refuse un client dont le dossier est déjà transmis", () => {
    assert.equal(
      canOpenCompanyDossierForm({
        planSlug: "beta",
        twilioDocsSubmittedAt: "2026-09-01",
      }),
      false
    );
  });
});

describe("canResumeCompanyDossier", () => {
  test("autorise un développeur à reprendre le dossier", () => {
    assert.equal(
      canResumeCompanyDossier({
        planSlug: "developpeur",
        accessUnlocked: true,
        twilioDocsSubmittedAt: null,
      }),
      true
    );
  });

  test("autorise le propriétaire plateforme à reprendre le dossier", () => {
    assert.equal(
      canResumeCompanyDossier({
        isPlatformOwner: true,
        accessUnlocked: true,
        twilioDocsSubmittedAt: "2026-09-01",
      }),
      true
    );
  });
});
