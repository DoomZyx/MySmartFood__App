import { generateEnrichedPromptWithPricing, packMenuForVoice } from "./pricingService.js";

describe("generateEnrichedPromptWithPricing", () => {
  const pricing = {
    restaurantInfo: {
      nom: "Chez Test",
      adresse: "1 rue",
      telephone: "01 23 45 67 89",
      email: "test@test.fr",
      horairesOuverture: {
        lundi: {
          ouvert: true,
          midi: { ouverture: "11:30", fermeture: "14:30" },
          soir: { ouverture: "19:00", fermeture: "22:30" },
        },
        dimanche: { ouvert: false },
      },
    },
    menu: {
      burgers: {
        nom: "Burgers",
        produits: [
          {
            nom: "Classic",
            prix: 12,
            description: "y".repeat(200),
            options: {
              sauce: {
                nom: "Sauce",
                choix: [{ nom: "Algérienne", prix: 0 }],
              },
            },
          },
        ],
      },
    },
    amenities: [],
  };

  test("injecte nom et prix sans options ni description longue", () => {
    const prompt = generateEnrichedPromptWithPricing("BASE", pricing);

    expect(prompt).toContain("Classic");
    expect(prompt).toContain("12€");
    expect(prompt).toContain("11:30-14:30");
    expect(prompt).not.toContain("OPTIONS PERSONNALISABLES");
    expect(prompt).not.toContain("Algérienne");
    expect(prompt).not.toContain("y".repeat(90));
  });
});

describe("packMenuForVoice", () => {
  test("garde nom et prix, coupe la description, retire les options", () => {
    const packed = packMenuForVoice({
      burgers: {
        nom: "Burgers",
        produits: [
          {
            nom: "Classic",
            prixBase: 12,
            disponible: true,
            description: "y".repeat(200),
            options: { sauce: ["ketchup"] },
          },
          { nom: "Indispo", prixBase: 10, disponible: false },
        ],
      },
      empty: { nom: "Vide", produits: [] },
    });

    expect(packed.empty).toBeUndefined();
    expect(packed.burgers.produits).toHaveLength(1);
    expect(packed.burgers.produits[0].nom).toBe("Classic");
    expect(packed.burgers.produits[0].prix).toBe(12);
    expect(packed.burgers.produits[0].options).toBeUndefined();
    expect(packed.burgers.produits[0].description.length).toBeLessThanOrEqual(80);
  });
});
