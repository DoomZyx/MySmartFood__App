/**
 * Dashboard opérationnel restaurant.
 * Données chargées via useDashboard (API : commandes, réservations, appels, pricing).
 */
import ActiveOrders from "./ActiveOrders";
import ActiveReservations from "./ActiveReservations";
import ServiceRadar from "./ServiceRadar";
import RestaurantCapacity from "./RestaurantCapacity";
import AgentStats from "./AgentStats";
import TokenUsageList from "./TokenUsageList";
import { useDashboard } from "../../Hooks/Dashboard/useDashboard";
import { useTokenUsage } from "../../Hooks/Dashboard/useTokenUsage";
import "./dashboard.scss";

function Dashboard() {
  const {
    loading,
    error,
    activeOrders,
    activeReservations,
    radarEvents,
    capacity,
    agentStats,
    refresh,
  } = useDashboard();
  const tokenUsage = useTokenUsage();

  if (loading) {
    return (
      <div className="dashboard-op dashboard-op--loading">
        <p className="dashboard-op__message">Chargement du dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-op dashboard-op--error">
        <p className="dashboard-op__message">{error}</p>
        <button type="button" className="dashboard-op__retry" onClick={refresh}>
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard-op">
      <ActiveOrders orders={activeOrders} />
      <ActiveReservations reservations={activeReservations} />
      <ServiceRadar events={radarEvents} />
      <RestaurantCapacity capacity={capacity} />
      <AgentStats stats={agentStats} />
      <TokenUsageList
        events={tokenUsage.events}
        totals={tokenUsage.totals}
        loading={tokenUsage.loading}
        error={tokenUsage.error}
      />
    </div>
  );
}

export default Dashboard;
