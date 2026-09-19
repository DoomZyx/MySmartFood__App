import { useState, useEffect } from "react";
import { fetchDashboardVenue } from "../../API/Dashboard/api";

export function useVenue() {
  const [venue, setVenue] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardVenue()
      .then((response) => {
        if (!cancelled && response?.success) setVenue(response.data || null);
      })
      .catch(() => {
        if (!cancelled) setVenue(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { venue };
}
