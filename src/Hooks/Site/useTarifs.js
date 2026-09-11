import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createCheckoutSession, fetchPlans } from "../../API/checkout";
import { isAuthenticated } from "../../API/auth";

export function useTarifs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutSlug, setCheckoutSlug] = useState("");
  const [error, setError] = useState(null);
  const cancelled = new URLSearchParams(location.search).get("checkout") === "cancelled";

  useEffect(() => {
    let cancelledFetch = false;
    (async () => {
      try {
        const list = await fetchPlans();
        if (!cancelledFetch) setPlans(list);
      } catch (err) {
        if (!cancelledFetch) setError(err.message);
      } finally {
        if (!cancelledFetch) setLoading(false);
      }
    })();
    return () => {
      cancelledFetch = true;
    };
  }, []);

  const subscribe = async (plan) => {
    setError(null);
    if (!isAuthenticated()) {
      navigate("/login", { state: { from: location } });
      return;
    }
    setCheckoutSlug(plan.slug);
    try {
      const session = await createCheckoutSession({ planSlug: plan.slug });
      if (session.url) {
        window.location.assign(session.url);
        return;
      }
      setError("Session de paiement introuvable");
    } catch (err) {
      if (err.code === "UNAUTHENTICATED") {
        navigate("/login", { state: { from: location } });
        return;
      }
      setError(err.message);
    } finally {
      setCheckoutSlug("");
    }
  };

  return {
    plans,
    loading,
    checkoutSlug,
    error,
    cancelled,
    subscribe,
  };
}
