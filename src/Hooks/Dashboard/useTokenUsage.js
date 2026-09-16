import { useCallback, useEffect, useState } from "react";
import { fetchLlmUsage } from "../../Services/usageService";

export function useTokenUsage() {
  const [events, setEvents] = useState([]);
  const [totals, setTotals] = useState({
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    events: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const payload = await fetchLlmUsage({ limit: 50 });
      const data = payload?.data || {};
      setEvents(Array.isArray(data.events) ? data.events : []);
      setTotals({
        inputTokens: data.totals?.inputTokens || 0,
        outputTokens: data.totals?.outputTokens || 0,
        totalTokens: data.totals?.totalTokens || 0,
        events: data.totals?.events || 0,
      });
      setError(null);
    } catch (requestError) {
      setError(requestError.message || "Impossible de récupérer l'usage LLM.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { events, totals, loading, error, refresh };
}
