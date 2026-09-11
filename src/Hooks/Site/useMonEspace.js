import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { fetchSession, getCurrentUser, hasDashboardAccess, isAuthenticated, resendAccessEmail } from "../../API/auth";

export function useMonEspace() {
  const location = useLocation();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const checkoutSuccess = new URLSearchParams(location.search).get("checkout") === "success";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isAuthenticated()) {
        if (!cancelled) setLoading(false);
        return;
      }
      const data = await fetchSession();
      if (!cancelled) {
        setSession(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const user = session?.user || getCurrentUser();

  const resendLink = async () => {
    setResending(true);
    setResendMessage("");
    setResendError("");
    try {
      await resendAccessEmail();
      setResendMessage("sent");
    } catch (err) {
      setResendError(err.message);
    } finally {
      setResending(false);
    }
  };

  return {
    loading,
    isLoggedIn: isAuthenticated(),
    user,
    hasDashboard: hasDashboardAccess(session || user),
    hasActiveSubscription: Boolean(user?.hasActiveSubscription),
    checkoutSuccess,
    resending,
    resendMessage,
    resendError,
    resendLink,
  };
}
