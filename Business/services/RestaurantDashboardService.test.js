import {
  assembleTodayDashboard,
  getCurrentService,
  mapOrderToActive,
} from "./RestaurantDashboardService.js";

describe("RestaurantDashboardService", () => {
  const horaires = {
    jeudi: {
      ouvert: true,
      midi: { ouverture: "12:00", fermeture: "14:00" },
      soir: { ouverture: "19:00", fermeture: "22:00" },
    },
  };

  test("détecte le service midi", () => {
    expect(getCurrentService(horaires, "jeudi", 12 * 60 + 30)).toEqual({
      service: "midi",
      start: 12 * 60,
      end: 14 * 60,
    });
  });

  test("hors créneau : pas de service", () => {
    expect(getCurrentService(horaires, "jeudi", 16 * 60)).toBe(null);
  });

  test("assembleTodayDashboard projette le service en cours seulement", () => {
    const currentService = getCurrentService(horaires, "jeudi", 12 * 60 + 30);
    const data = assembleTodayDashboard({
      orders: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          nom: "Midi",
          heure: "12:30",
          statut: "confirme",
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          nom: "Soir",
          heure: "19:30",
          statut: "confirme",
        },
      ],
      reservations: [
        { id: "r1", nom: "Table", heure: "12:45", statut: "confirme", nombrePersonnes: 4 },
        { id: "r2", nom: "Annulée", heure: "12:15", statut: "annule", nombrePersonnes: 2 },
      ],
      currentService,
      nowMinutes: 12 * 60 + 30,
      totalCapacity: 20,
    });

    expect(data.activeOrders).toHaveLength(1);
    expect(data.activeOrders[0].client).toBe("Midi");
    expect(data.activeReservations).toEqual([
      { time: "12:45", guests: 4, table: null },
    ]);
    expect(data.capacity).toEqual({ occupied: 4, total: 20 });
    expect(data.agentStats).toEqual({
      callsHandled: 4,
      ordersCreated: 2,
      reservationsCreated: 2,
    });
    expect(data.radarEvents).toEqual([
      { time: "12:30", type: "takeaway" },
      { time: "12:45", type: "reservation", guests: 4 },
    ]);
  });

  test("mapOrderToActive raccourcit l id", () => {
    expect(
      mapOrderToActive({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        nom: "Alex",
        heure: "12:00",
        statut: "en_cours",
      })
    ).toEqual({
      id: "aaaaaa",
      client: "Alex",
      type: "takeaway",
      status: "En préparation",
      time: "12:00",
    });
  });
});
