import {
  assertTimeInOpeningHours,
  formatHoursForVoiceTools,
} from "./OpeningHoursPolicy.js";
import { BusinessRuleError } from "../validators/businessRules.js";

const HORAIRES = {
  lundi: {
    ouvert: true,
    midi: { ouverture: "11:30", fermeture: "14:30" },
    soir: { ouverture: "19:00", fermeture: "22:30" },
  },
  mardi: { ouvert: false },
  mercredi: {
    ouvert: true,
    midi: { ouverture: "11:30", fermeture: "14:30" },
    soir: { ouverture: "19:00", fermeture: "22:30" },
  },
  jeudi: {
    ouvert: true,
    midi: { ouverture: "11:30", fermeture: "14:30" },
    soir: { ouverture: "19:00", fermeture: "22:30" },
  },
  vendredi: {
    ouvert: true,
    midi: { ouverture: "11:30", fermeture: "14:30" },
    soir: { ouverture: "19:00", fermeture: "22:30" },
  },
  samedi: {
    ouvert: true,
    midi: { ouverture: "12:00", fermeture: "15:00" },
    soir: { ouverture: "18:00", fermeture: "00:00" },
  },
  dimanche: { ouvert: false },
};

describe("formatHoursForVoiceTools", () => {
  test("liste les plages jour par jour sans bornes hardcodees", () => {
    const text = formatHoursForVoiceTools(HORAIRES);

    expect(text).toContain("Samedi: 12:00-15:00 et 18:00-00:00");
    expect(text).toContain("Lundi: 11:30-14:30 et 19:00-22:30");
    expect(text).toContain("Dimanche: ferme");
    expect(text).toContain("Mardi: ferme");
    expect(text).not.toContain("11h-15h");
    expect(text).not.toContain("18h-00h");
    expect(text).not.toContain("Service MIDI observe");
  });

  test("reste utilisable si les horaires sont absents", () => {
    const text = formatHoursForVoiceTools(null);
    expect(text).toContain("horaires du restaurant");
    expect(text).not.toContain("11h-15h");
  });
});

describe("assertTimeInOpeningHours", () => {
  test("accepte une heure dans la plage du jour", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: HORAIRES,
        dateYmd: "2026-09-19",
        hhmm: "19:00",
      })
    ).not.toThrow();
  });

  test("refuse une heure entre midi et soir", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: HORAIRES,
        dateYmd: "2026-09-19",
        hhmm: "16:00",
      })
    ).toThrow(BusinessRuleError);
  });

  test("refuse un jour ferme", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: HORAIRES,
        dateYmd: "2026-09-20",
        hhmm: "12:00",
      })
    ).toThrow(/Heure hors horaires/);
  });

  test("refuse une heure avant l ouverture du lundi", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: HORAIRES,
        dateYmd: "2026-09-21",
        hhmm: "11:15",
      })
    ).toThrow(/Heure hors horaires/);
  });

  test("accepte une fermeture overnight le samedi", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: HORAIRES,
        dateYmd: "2026-09-19",
        hhmm: "23:45",
      })
    ).not.toThrow();
  });

  test("ne bloque pas si aucun jour n est configure", () => {
    expect(() =>
      assertTimeInOpeningHours({
        horaires: {},
        dateYmd: "2026-09-19",
        hhmm: "19:00",
      })
    ).not.toThrow();
  });
});
