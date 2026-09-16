import { useState } from "react";

// Fonction pour obtenir la date du jour au format YYYY-MM-DD
const getTodayDate = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function useAppointmentsFilters() {
  const [filters, setFilters] = useState({
    date: getTodayDate(),
    type: "",
    modalite: "",
  });

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      date: getTodayDate(),
      type: "",
      modalite: "",
    });
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== "");
  };

  const getFilterParams = () => {
    // Retourner seulement les filtres non vides
    const activeFilters = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "") {
        activeFilters[key] = value;
      }
    });
    return activeFilters;
  };

  return {
    filters,
    setFilters,
    handleFilterChange,
    resetFilters,
    hasActiveFilters,
    getFilterParams,
  };
}
