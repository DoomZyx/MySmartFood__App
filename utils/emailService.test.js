import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildDossierAcceptedEmail } from "./emailService.js";

describe("buildDossierAcceptedEmail", () => {
  test("annonce l'acceptation du dossier avec les liens site et tableau de bord", () => {
    const mail = buildDossierAcceptedEmail({
      name: "Alex",
      businessName: "TastyCrousty",
      siteUrl: "http://localhost:5174/mon-espace",
      dashboardUrl: "http://localhost:5174/app",
    });
    assert.equal(mail.subject, "Votre dossier restaurant a été validé");
    assert.match(mail.text, /Bonjour Alex/);
    assert.match(mail.text, /TastyCrousty/);
    assert.match(mail.text, /http:\/\/localhost:5174\/mon-espace/);
    assert.match(mail.text, /http:\/\/localhost:5174\/app/);
  });
});
