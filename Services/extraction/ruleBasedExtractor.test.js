import { extractTime } from "./ruleBasedExtractor.js";

describe("extractTime", () => {
  test("garde 8h telle quelle", () => {
    expect(extractTime("Une commande pour 8h")).toBe("08:00");
  });

  test("garde 9h telle quelle", () => {
    expect(extractTime("On se voit a 9h")).toBe("09:00");
  });

  test("conserve 20h si le client la dit", () => {
    expect(extractTime("Une reservation a 20h")).toBe("20:00");
  });

  test("conserve 8h30", () => {
    expect(extractTime("A 8h30 s il vous plait")).toBe("08:30");
  });
});
