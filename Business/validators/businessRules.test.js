import {
  assertCapacity,
  assertHhmm,
  assertOptionSelection,
  assertPhone,
  assertPriceCents,
  assertProduct,
  BusinessRuleError,
  slotKindForTime,
} from "./businessRules.js";
import { mapOrderStatusToFr, mapOrderStatusToPg, eurosToCents } from "../mappers/legacyStatus.js";
import { orderToLegacy } from "../mappers/orderMapper.js";
import { hoursFromLegacy, hoursToLegacy } from "../mappers/pricingMapper.js";

describe("règles métier", () => {
  test("refuse un téléphone trop court", () => {
    expect(() => assertPhone("123")).toThrow(BusinessRuleError);
  });

  test("normalise une heure 19h30", () => {
    expect(assertHhmm("19h30")).toBe("19:30");
  });

  test("exige un prix catalogue strictement positif", () => {
    expect(() => assertPriceCents(0)).toThrow(/supérieur à 0/);
    expect(assertPriceCents(850)).toBe(850);
  });

  test("valide un produit pizza et refuse une taille inconnue", () => {
    expect(() => assertProduct({ nom: "Margherita", prixBase: 11, taille: "XXL" }, "pizzas")).toThrow(
      /Taille invalide/
    );
    expect(() => assertProduct({ nom: "Margherita", prixBase: 11, taille: "M" }, "pizzas")).not.toThrow();
  });

  test("contrôle min/max des options", () => {
    const group = { name: "Viandes", minSelect: 1, maxSelect: 2, isRequired: true, selectionType: "multiple" };
    expect(() => assertOptionSelection(group, [])).toThrow(/obligatoire/);
    expect(() => assertOptionSelection(group, ["Poulet", "Cordon", "Tenders"])).toThrow(/Trop de choix/);
    expect(() => assertOptionSelection(group, ["Poulet"])).not.toThrow();
  });

  test("refuse un dépassement de capacité", () => {
    try {
      assertCapacity(4, 2);
      throw new Error("devrait échouer");
    } catch (err) {
      expect(err).toBeInstanceOf(BusinessRuleError);
      expect(err.remainingCovers).toBe(2);
      expect(err.requestedCovers).toBe(4);
    }
  });

  test("classe un horaire dans le service midi ou soir", () => {
    const day = {
      midi: { ouverture: "11:00", fermeture: "14:30" },
      soir: { ouverture: "18:00", fermeture: "22:30" },
    };
    expect(slotKindForTime("12:00", day)).toBe("midi");
    expect(slotKindForTime("19:30", day)).toBe("soir");
    expect(slotKindForTime("16:00", day)).toBeNull();
  });
});

describe("contrats JSON legacy", () => {
  test("mappe les statuts français vers PostgreSQL et retour", () => {
    expect(mapOrderStatusToPg("confirme")).toBe("confirmed");
    expect(mapOrderStatusToFr("confirmed", "confirme")).toBe("confirme");
    expect(eurosToCents(8.5)).toBe(850);
  });

  test("reproduit date + heure + commandes pour le dashboard", () => {
    const json = orderToLegacy(
      {
        id: "11111111-1111-1111-1111-111111111111",
        tenantId: "11111111-1111-1111-1111-111111111111",
        guestName: "Ada",
        guestPhone: "0611223344",
        pickupAt: new Date("2026-03-02T11:30:00.000Z"),
        status: "confirmed",
        legacyStatus: "confirme",
        createdBy: "system",
        reminderEmailSent: false,
        reminderSmsSent: false,
        items: [
          {
            menuItemId: "item-1",
            label: "Tacos M",
            category: "tacos",
            quantity: 1,
            unitPriceCents: 850,
            composition: "Poulet",
            options: [{ groupName: "viandes", optionName: "Poulet" }],
          },
        ],
        totalCents: 850,
      },
      "UTC"
    );
    expect(json._id).toBe("11111111-1111-1111-1111-111111111111");
    expect(json.statut).toBe("confirme");
    expect(json.heure).toBe("11:30");
    expect(json.commandes[0].prixUnitaire).toBe(8.5);
    expect(json.commandes[0].options.viandes).toBe("Poulet");
  });

  test("conserve les deux plages midi/soir et un jour fermé", () => {
    const horaires = {
      lundi: {
        ouvert: true,
        midi: { ouverture: "11:00", fermeture: "14:30" },
        soir: { ouverture: "18:00", fermeture: "22:30" },
      },
      mardi: { ouvert: false },
    };
    const slots = hoursFromLegacy(horaires);
    expect(slots).toHaveLength(2);
    expect(slots.map((slot) => slot.slotKind).sort()).toEqual(["midi", "soir"]);
    const back = hoursToLegacy(slots);
    expect(back.lundi.ouvert).toBe(true);
    expect(back.mardi?.ouvert).toBe(false);
  });
});
