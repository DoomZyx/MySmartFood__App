/**
 * Données mockées pour le dashboard restaurant.
 * Remplacer par des appels API (hooks/services) en production.
 */

export const mockActiveOrders = [
  { id: 1245, client: "Marie Dupont", type: "takeaway", status: "En préparation", time: "12:15" },
  { id: 1246, client: "Jean Martin", type: "livraison", status: "Prête", time: "12:20" },
  { id: 1247, client: "Sophie Bernard", type: "takeaway", status: "En préparation", time: "12:25" },
];

export const mockActiveReservations = [
  { time: "12:30", guests: 4, table: "Table 4" },
  { time: "12:45", guests: 2, table: "Table 2" },
  { time: "13:00", guests: 6, table: null },
  { time: "13:15", guests: 2, table: "Table 1" },
];

export const mockRadarEvents = [
  { time: "12:30", type: "reservation", guests: 4 },
  { time: "12:45", type: "takeaway" },
  { time: "13:00", type: "reservation", guests: 2 },
  { time: "13:15", type: "reservation", guests: 6 },
  { time: "13:30", type: "takeaway" },
  { time: "13:45", type: "reservation", guests: 4 },
];

export const mockCapacity = {
  occupied: 17,
  total: 30,
};

export const mockAgentStats = {
  callsHandled: 12,
  ordersCreated: 7,
  reservationsCreated: 5,
};
