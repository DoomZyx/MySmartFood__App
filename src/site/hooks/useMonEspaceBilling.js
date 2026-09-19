import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./useAuth";
import { useCheckout } from "./useCheckout";
import { stillNeedsPayment } from "@shared/companyOnboarding";

export function useMonEspaceBilling() {
  const { user, refreshUser } = useAuth();
  const {
    syncCheckoutSession,
    createPortalSession,
    createCheckoutSession,
    startBetaAccess,
    isLoading,
    error,
  } = useCheckout();
  const [searchParams, setSearchParams] = useSearchParams();
  const [syncState, setSyncState] = useState(null);

  useEffect(() => {
    if (!user?.id) return undefined;

    const checkout = searchParams.get("checkout");
    const sessionId = searchParams.get("session_id");
    const looksUnpaid = stillNeedsPayment(user);
    if (checkout !== "success" && !sessionId && !looksUnpaid) return undefined;

    let cancelled = false;
    setSyncState("syncing");
    syncCheckoutSession(sessionId)
      .then(() => refreshUser())
      .then(() => {
        if (!cancelled) setSyncState("ok");
        if (cancelled || !sessionId) return;
        const next = new URLSearchParams(searchParams);
        next.delete("checkout");
        next.delete("session_id");
        setSearchParams(next, { replace: true });
      })
      .catch(() => {
        if (!cancelled) setSyncState("error");
      });

    return () => {
      cancelled = true;
    };
    // Une fois par compte : retour Stripe ou compte encore marqué non payé.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const startBetaCheckout = async (planId) => {
    await startBetaAccess();
    await refreshUser();
    await createCheckoutSession(planId);
  };

  return {
    user,
    syncState,
    openPortal: createPortalSession,
    startBetaCheckout,
    isLoading,
    error,
    hasBillingPortal: Boolean(user?.hasBillingPortal || user?.stripeCustomerId),
  };
}
