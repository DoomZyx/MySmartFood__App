import { buildGreetingInstruction } from "./SessionHandler.js";

describe("buildGreetingInstruction", () => {
  test("produit un accueil naturel avec le nom du restaurant", () => {
    expect(buildGreetingInstruction("Chez Test")).toBe(
      "Dis exactement cette phrase, avec un ton naturel et accueillant : Chez Test, bonjour. Que puis-je faire pour vous ?",
    );
  });

  test("utilise un accueil naturel quand le nom est indisponible", () => {
    expect(buildGreetingInstruction()).toBe(
      "Dis exactement cette phrase, avec un ton naturel et accueillant : Bonjour, que puis-je faire pour vous ?",
    );
  });
});
