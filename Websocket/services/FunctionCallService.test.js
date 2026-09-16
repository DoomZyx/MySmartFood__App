import { compactSlotWindows, summarizeAvailabilityForLlm } from "./FunctionCallService.js";

describe("summarizeAvailabilityForLlm", () => {
  test("compacte une journée midi/soir en deux fenêtres", () => {
    const summary = summarizeAvailabilityForLlm({
      date: "2026-09-15",
      slots: ["11:00", "11:30", "12:00", "12:30", "18:00", "18:30", "19:00"],
      remainingCoversMidi: 8,
      remainingCoversSoir: 4,
    });

    expect(summary.success).toBe(true);
    expect(summary.closed).toBe(false);
    expect(summary.fenetres).toEqual([
      { debut: "11:00", fin: "12:30" },
      { debut: "18:00", fin: "19:00" },
    ]);
    expect(summary).not.toHaveProperty("slots");
    expect(summary.remainingCoversMidi).toBe(8);
    expect(summary.instruction).toContain("Ne lis pas les créneaux");
  });

  test("signale un jour fermé sans liste vide à réciter", () => {
    expect(compactSlotWindows([])).toEqual([]);
    const summary = summarizeAvailabilityForLlm({
      date: "2026-09-15",
      slots: [],
      message: "Restaurant fermé ce jour-là",
    });
    expect(summary.closed).toBe(true);
    expect(summary.fenetres).toEqual([]);
    expect(summary.message).toBe("Restaurant fermé ce jour-là");
  });
});
