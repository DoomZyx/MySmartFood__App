import { useState } from "react";

export function useCallFilters() {
  const [filters, setFilters] = useState({
    status: "",
    date: "",
    search: "",
  });

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    return newFilters; // Retourner les nouveaux filtres pour usage immédiat
  };

  const resetFilters = () => {
    const resetFilters = { status: "", date: "", search: "" };
    setFilters(resetFilters);
    return resetFilters;
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => value !== "");
  };

  return {
    filters,
    setFilters,
    handleFilterChange,
    resetFilters,
    hasActiveFilters,
  };
}
