import { useState, useEffect, useCallback } from "react";
import { fetchDashboardToday } from "../../API/Dashboard/api";

const EMPTY_STATS = {
  callsHandled: 0,
  ordersCreated: 0,
  reservationsCreated: 0,
};

export function useDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeOrders, setActiveOrders] = useState([]);
  const [activeReservations, setActiveReservations] = useState([]);
  const [radarEvents, setRadarEvents] = useState([]);
  const [capacity, setCapacity] = useState({ occupied: 0, total: 0 });
  const [agentStats, setAgentStats] = useState(EMPTY_STATS);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchDashboardToday();
      if (!response?.success || !response.data) {
        throw new Error("Erreur chargement dashboard");
      }
      const data = response.data;
      setActiveOrders(Array.isArray(data.activeOrders) ? data.activeOrders : []);
      setActiveReservations(
        Array.isArray(data.activeReservations) ? data.activeReservations : []
      );
      setRadarEvents(Array.isArray(data.radarEvents) ? data.radarEvents : []);
      setCapacity(data.capacity || { occupied: 0, total: 0 });
      setAgentStats({ ...EMPTY_STATS, ...data.agentStats });
    } catch (err) {
      setError(err?.message || "Erreur chargement dashboard");
      setActiveOrders([]);
      setActiveReservations([]);
      setRadarEvents([]);
      setCapacity({ occupied: 0, total: 0 });
      setAgentStats(EMPTY_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    loading,
    error,
    activeOrders,
    activeReservations,
    radarEvents,
    capacity,
    agentStats,
    refresh: load,
  };
}
