import { useState, useEffect } from 'react';
import { fetchTodayReservations, fetchTodayOrders } from '../../API/Appointment/api.js';
import { fetchPricing } from '../../API/Pricing/api.js';

export function useKpi() {
  const [kpiData, setKpiData] = useState({
    totalNouveau: 0,
    totalEnCours: 0,
    totalTermine: 0,
    totalAnnule: 0,
    newToday: 0,
    pendingOld: 0,
    takeAwayCount: 0,
    reservationCount: 0,
    remainingSeats: null
  });
  const [todayOrders, setTodayOrders] = useState([]);
  const [upcomingOrders, setUpcomingOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadKpiData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [reservationsRes, ordersRes, pricingRes] = await Promise.allSettled([
        fetchTodayReservations(),
        fetchTodayOrders(),
        fetchPricing()
      ]);

      const reservations = (reservationsRes.status === 'fulfilled' && reservationsRes.value?.success && Array.isArray(reservationsRes.value.data))
        ? reservationsRes.value.data.map(r => ({ ...r, type: 'Réservation de table', modalite: 'Sur place' }))
        : [];
      const ordersList = (ordersRes.status === 'fulfilled' && ordersRes.value?.success && Array.isArray(ordersRes.value.data))
        ? ordersRes.value.data.map(o => ({ ...o, type: 'Commande à emporter', modalite: o.modalite || 'À emporter' }))
        : [];
      const orders = [...reservations, ...ordersList];
      setTodayOrders(orders);

      let capacity = null;
      if (pricingRes.status === 'fulfilled' && pricingRes.value?.success) {
        capacity = pricingRes.value.data?.restaurantInfo?.nombreCouverts ?? null;
      }

      const takeAwayCount = orders.filter(o => o.type === 'Commande à emporter').length;
      const reservationOrders = orders.filter(o =>
        o.type === 'Réservation de table' &&
        o.statut !== 'annule' &&
        o.statut !== 'termine'
      );
      const reservationCount = reservationOrders.length;
      const reservedSeats = reservationOrders
        .map(o => Number(o.nombrePersonnes) || 0)
        .reduce((a, b) => a + b, 0);
      const remainingSeats = capacity == null ? null : Math.max(capacity - reservedSeats, 0);

      const totalNouveau = orders.filter(o => o.statut === 'confirme' || o.statut === 'planifie').length;
      const totalEnCours = orders.filter(o => o.statut === 'en_cours').length;
      const totalTermine = orders.filter(o => o.statut === 'termine').length;
      const totalAnnule = orders.filter(o => o.statut === 'annule').length;

      const now = new Date();
      const in15Minutes = new Date(now.getTime() + 15 * 60 * 1000);

      const upcoming = orders
        .filter(order => {
          if (order.statut === 'annule' || order.statut === 'termine') return false;
          const orderDateTime = new Date(order.date);
          const [hours, minutes] = (order.heure || '').split(':').map(Number);
          if (Number.isNaN(hours)) return false;
          orderDateTime.setHours(hours, minutes, 0, 0);
          return orderDateTime >= now && orderDateTime <= in15Minutes;
        })
        .sort((a, b) => {
          const timeA = new Date(a.date);
          const [hoursA, minutesA] = (a.heure || '').split(':').map(Number);
          timeA.setHours(hoursA, minutesA, 0, 0);
          const timeB = new Date(b.date);
          const [hoursB, minutesB] = (b.heure || '').split(':').map(Number);
          timeB.setHours(hoursB, minutesB, 0, 0);
          return timeA - timeB;
        })
        .slice(0, 5);

      setUpcomingOrders(upcoming);

      setKpiData({
        totalNouveau,
        totalEnCours,
        totalTermine,
        totalAnnule,
        newToday: orders.length,
        pendingOld: 0,
        takeAwayCount,
        reservationCount,
        remainingSeats
      });
    } catch (err) {
      setError(err?.message);
      setTodayOrders([]);
      setUpcomingOrders([]);
      setKpiData({
        totalNouveau: 0,
        totalEnCours: 0,
        totalTermine: 0,
        totalAnnule: 0,
        newToday: 0,
        pendingOld: 0,
        takeAwayCount: 0,
        reservationCount: 0,
        remainingSeats: null
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKpiData();
  }, []);

  // Fonction pour rafraîchir les données
  const refreshKpiData = () => {
    loadKpiData();
  };

  return {
    kpiData,
    todayOrders,
    upcomingOrders,
    loading,
    error,
    refreshKpiData
  };
} 