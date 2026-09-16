import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { redeemAccessToken } from "../../API/auth";
import { openDashboard } from "@shared/dashboardPath";

export function useAccessRedeem() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setError("Lien d'accès incomplet");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await redeemAccessToken(token);
        if (!cancelled) openDashboard(navigate);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return { loading, error };
}
