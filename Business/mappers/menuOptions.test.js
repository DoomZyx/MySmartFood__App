import {
  findCatalogOption,
  formatAmenitiesForPrompt,
  formatOptionChoices,
  parseChoice,
  selectedOptionNames,
} from "./menuOptions.js";

describe("menuOptions", () => {
  test("parseChoice accepte string et objet", () => {
    expect(parseChoice("Poulet")).toEqual({ nom: "Poulet", prix: 0 });
    expect(parseChoice({ nom: "Merguez", prix: 0.5 })).toEqual({
      nom: "Merguez",
      prix: 0.5,
    });
  });

  test("formatOptionChoices affiche les supplements", () => {
    expect(
      formatOptionChoices(["Poulet", { nom: "Merguez", prix: 0.5 }])
    ).toBe("Poulet, Merguez (+0.50€)");
  });

  test("selectedOptionNames aplatit les selections", () => {
    expect(selectedOptionNames("Poulet")).toEqual(["Poulet"]);
    expect(selectedOptionNames(["Algérienne", "Blanche"])).toEqual([
      "Algérienne",
      "Blanche",
    ]);
  });

  test("findCatalogOption matche slug legacy et nom", () => {
    const rows = [
      {
        groupName: "Viandes",
        slug: "abcd1234-viandes",
        legacyPayload: { slug: "viandes" },
        optionName: "Merguez",
        priceCents: 50,
      },
    ];
    expect(findCatalogOption(rows, "viandes", "Merguez")?.priceCents).toBe(50);
  });

  test("formatAmenitiesForPrompt ne invente pas si unknown", () => {
    const text = formatAmenitiesForPrompt(
      { accessibilitePmr: null, nombreChaisesBebe: null },
      [
        { slug: "pmr", status: "unknown" },
        { slug: "highchair", status: "unknown" },
      ]
    );
    expect(text).toContain("Non renseigne");
  });

  test("formatAmenitiesForPrompt utilise quantite et PMR", () => {
    const text = formatAmenitiesForPrompt(
      { accessibilitePmr: true, nombreChaisesBebe: 3 },
      [
        { slug: "pmr", status: "available" },
        { slug: "highchair", status: "available", quantity: 3 },
      ]
    );
    expect(text).toContain("Oui");
    expect(text).toContain("3 chaise");
  });
});
