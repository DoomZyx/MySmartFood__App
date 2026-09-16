import { useCallback, useState, useEffect } from "react";
import { getPhoneLineStatus, updatePhoneLineEnabled } from "../../API/PhoneLine/api";

export function usePhoneToggle() {
  const [isOn, setIsOn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await getPhoneLineStatus();
      if (res?.success && typeof res?.data?.phoneLineEnabled === "boolean") {
        setIsOn(res.data.phoneLineEnabled);
      }
    } catch (e) {
      setError("Impossible de charger l'état de la ligne");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const toggle = useCallback(async () => {
    if (isBusy) return;
    const nextState = !isOn;
    setIsBusy(true);
    setError(null);
    setIsOn(nextState);
    try {
      const res = await updatePhoneLineEnabled(nextState);
      if (!res?.success) {
        setIsOn(!nextState);
        setError(res?.error ?? res?.message ?? "Une erreur est survenue");
      }
    } catch (e) {
      setIsOn(!nextState);
      setError(e?.message || "Une erreur est survenue");
    } finally {
      setIsBusy(false);
    }
  }, [isOn, isBusy]);

  return {
    isOn,
    isBusy: isBusy || loading,
    error,
    toggle,
  };
}



