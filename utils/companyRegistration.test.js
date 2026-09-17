import { hasCompanyRegistration, parseCompanyRegistration } from "./companyRegistration.js";

describe("parseCompanyRegistration", () => {
  test("accepte un SIRET et dérive le SIREN", () => {
    expect(parseCompanyRegistration({ siret: "732 829 320 00074" })).toEqual({
      siret: "73282932000074",
      siren: "732829320",
    });
  });

  test("accepte un SIREN si le SIRET est inconnu", () => {
    expect(parseCompanyRegistration({ companyNumber: "732829320" })).toEqual({
      siret: null,
      siren: "732829320",
    });
  });

  test("refuse un numéro trop court sauf si optionnel et vide", () => {
    expect(parseCompanyRegistration({})).toEqual({ siret: null, siren: null });
    expect(() => parseCompanyRegistration({ siret: "123" })).toThrow(/SIRET|SIREN/);
    expect(() => parseCompanyRegistration({}, { required: true })).toThrow(/SIRET/);
  });

  test("refuse une clé Luhn invalide", () => {
    expect(() => parseCompanyRegistration({ siret: "73282932000075" })).toThrow("SIRET invalide");
  });
});

describe("hasCompanyRegistration", () => {
  test("détecte SIRET ou SIREN", () => {
    expect(hasCompanyRegistration({ siret: "73282932000074" })).toBe(true);
    expect(hasCompanyRegistration({ siren: "732829320" })).toBe(true);
    expect(hasCompanyRegistration({})).toBe(false);
  });
});
