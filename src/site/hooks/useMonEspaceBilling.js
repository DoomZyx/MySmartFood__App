import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useCheckout } from "./useCheckout";

export function useMonEspaceBilling() {
  const { user, refreshUser } = useAuth();
  const { syncCheckoutSession, createPortalSession, isLoading, error } = useCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [syncState, setSyncState] = useState(null);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    if (checkout !== "success" || !sessionId) return undefined;

    let cancelled = false;
    setSyncState("syncing");
    syncCheckoutSession(sessionId)
      .then(() => refreshUser())
      .then(() => {
        if (!cancelled) setSyncState("ok");
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      })
      .finally(() => {
        if (cancelled) return;
        const next = new URLSearchParams(searchParams);
        next.delete("checkout");
        next.delete("session_id");
        setSearchParams(next, { replace: true });
      });

    return () => {
      cancelled = true;
    };
    // Une seule fois au retour Stripe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user,
    syncState,
    openPortal: createPortalSession,
    isLoading,
    error,
    hasBillingPortal: Boolean(user?.hasBillingPortal || user?.stripeCustomerId),
  };
}
