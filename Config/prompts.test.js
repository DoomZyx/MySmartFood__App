import { getSystemMessage } from "./prompts.js";

describe("getSystemMessage", () => {
  test("demande un échange humain sans accusés de réception mécaniques", () => {
    const prompt = getSystemMessage({ nom: "Chez Test" });

    expect(prompt).toContain(
      "Parle comme dans une vraie conversation téléphonique",
    );
    expect(prompt).toContain(
      "Ne fais pas d'accusé de réception automatique à chaque réponse",
    );
    expect(prompt).toContain("Pose une seule question utile à la fois");
    expect(prompt).not.toContain("phrases courtes (10 mots max)");
    expect(prompt).not.toContain(
      'Demande a chaque commandes de plats ou menu, "Ca sera tout ?"',
    );
  });

  test("conserve les règles métier essentielles", () => {
    const prompt = getSystemMessage({ nom: "Chez Test" });

    expect(prompt).toContain("Chez Test");
    expect(prompt).toContain("Utilise UNIQUEMENT les produits du menu");
    expect(prompt).toContain("Demande TOUJOURS quelle boisson");
    expect(prompt).toContain("Un seul récapitulatif final");
    expect(prompt).toContain("Ne demande JAMAIS son numéro");
  });
});
