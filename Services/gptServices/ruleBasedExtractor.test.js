import { extractWithRules } from "./ruleBasedExtractor.js";

describe("extractWithRules heures", () => {
  test("n invente pas 20h quand le client dit 8h", () => {
    const result = extractWithRules("Je voudrais une commande a emporter pour 8h");
    expect(result.appointment?.heure).toBe("08:00");
  });
});
