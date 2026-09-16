import { useState, useCallback } from 'react';
import { fetchCalls } from "../../API/Calls/api.js";

export function useSearch() {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchCalls = useCallback(async (searchTerm) => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      // Déterminer le type de recherche
      const isDateSearch = /^\d{4}-\d{2}-\d{2}$/.test(searchTerm.trim());

      let response;

      if (isDateSearch) {
        // Recherche par date
        response = await fetchCalls(1, 50, { date: searchTerm.trim() });
      } else {
        // Recherche par nom de client
        response = await fetchCalls(1, 50, { nom: searchTerm.trim() });
      }

      if (response.success) {
        setSearchResults(response.data || []);
      } else {
        throw new Error("Erreur lors de la recherche");
      }
    } catch (err) {
      setError(err.message);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
  }, []);

  return {
    searchResults,
    loading,
    error,
    hasSearched,
    searchCalls,
    clearSearch,
  };
} 