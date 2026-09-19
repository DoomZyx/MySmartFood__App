import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { shouldShowDossierAcceptedNotice } from "./dossierAcceptedNotice.js";

describe("shouldShowDossierAcceptedNotice", () => {
  test("affiche la modal seulement si le dossier vient d'être accepté", () => {
    assert.equal(shouldShowDossierAcceptedNotice(null), false);
    assert.equal(shouldShowDossierAcceptedNotice({}), false);
    assert.equal(
      shouldShowDossierAcceptedNotice({ dossierNoticePending: false }),
      false
    );
    assert.equal(
      shouldShowDossierAcceptedNotice({ dossierNoticePending: true }),
      true
    );
  });
});
