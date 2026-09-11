import { resolveSizeLabel } from "./pricingMapper.js";

describe("resolveSizeLabel", () => {
  test("garde la taille explicite", () => {
    expect(resolveSizeLabel({ taille: "33cl", description: "Petite" })).toBe("33cl");
  });

  test("lit Petite / Moyenne / Grande depuis la description", () => {
    expect(resolveSizeLabel({ description: "Petite" })).toBe("Petite");
    expect(resolveSizeLabel({ description: "Moyenne" })).toBe("Moyenne");
    expect(resolveSizeLabel({ description: "Grande" })).toBe("Grande");
  });

  test("extrait un volume en cl ou L depuis la description", () => {
    expect(resolveSizeLabel({ description: "(33cl)" })).toBe("33cl");
    expect(resolveSizeLabel({ description: "Bouteille 1L" })).toBe("1L");
  });

  test("laisse vide une description métier", () => {
    expect(resolveSizeLabel({ description: "Wrap, frites, 1 viande" })).toBeNull();
    expect(resolveSizeLabel({})).toBeNull();
  });
});
