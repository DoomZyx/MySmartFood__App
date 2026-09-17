import {
  isTwilioBundleLocked,
  splitPersonName,
  twilioEndUserAttributes,
  twilioSupportingDocumentForKind,
} from "./TwilioProvisioningService.js";

describe("TwilioProvisioningService mapping", () => {
  test("découpe le nom du dirigeant", () => {
    expect(splitPersonName("Jean Dupont")).toEqual({
      firstName: "Jean",
      lastName: "Dupont",
    });
    expect(splitPersonName("Ada")).toEqual({ firstName: "Ada", lastName: "Ada" });
  });

  test("ne mappe pas mime_type ni bundle_sid sur government_issued_document", () => {
    const spec = twilioSupportingDocumentForKind("id_recto", {
      firstName: "Jean",
      lastName: "Dupont",
      businessName: "Chez Test",
      registrationNumber: "123",
      addressSid: "ADxxx",
    });
    expect(spec.type).toBe("government_issued_document");
    expect(spec.attributes).toEqual({
      first_name: "Jean",
      last_name: "Dupont",
      business_name: "Chez Test",
    });
    expect(spec.attributes).not.toHaveProperty("mime_type");
    expect(spec.attributes).not.toHaveProperty("bundle_sid");
  });

  test("mappe le justificatif d'adresse en utility_bill avec address_sids", () => {
    const spec = twilioSupportingDocumentForKind("address_proof", {
      addressSid: "ADxxx",
    });
    expect(spec).toEqual({
      type: "utility_bill",
      attributes: { address_sids: ["ADxxx"] },
    });
  });

  test("mappe le Kbis en extrait du registre du commerce", () => {
    const spec = twilioSupportingDocumentForKind("kbis", {
      firstName: "Jean",
      lastName: "Dupont",
      businessName: "Chez Test",
      registrationNumber: "12345678901234",
      addressSid: "ADxxx",
    });
    expect(spec.type).toBe("commercial_registrar_excerpt");
    expect(spec.attributes.business_registration_number).toBe("12345678901234");
  });

  test("end-user FR exige les champs réglementaires, pas mime_type", () => {
    const attrs = twilioEndUserAttributes(
      "FR",
      {
        businessName: "Chez Test",
        siret: "12345678901234",
        email: "resto@example.com",
      },
      { firstName: "Jean", lastName: "Dupont" },
      "https://www.mysmartfood.fr"
    );
    expect(attrs).toMatchObject({
      business_name: "Chez Test",
      business_registration_number: "12345678901234",
      first_name: "Jean",
      last_name: "Dupont",
      email: "resto@example.com",
    });
    expect(attrs).not.toHaveProperty("mime_type");
    expect(attrs).not.toHaveProperty("bundle_sid");
  });

  test("un bundle draft n'est pas verrouillé", () => {
    expect(isTwilioBundleLocked({ status: "draft" })).toBe(false);
    expect(isTwilioBundleLocked({ status: "pending-review" })).toBe(true);
  });
});
