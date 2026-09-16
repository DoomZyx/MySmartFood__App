import React, { createContext, useState, useEffect, useCallback } from "react";
import { getCurrentUser, logoutApi } from "../services/authService";
import { syncDashboardSession } from "../services/syncDashboardSession";

export const AuthContext = createContext(null);

const STORAGE_KEY_USER = "smartcrm_user";

function logAuthError(message, err) {
  if (import.meta.env.DEV && typeof console !== "undefined" && console.error) {
    console.error(`[Auth] ${message}`, err?.message ?? err);
  }
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState(null);

  const isAuthenticated = !!user;

  const setAuth = useCallback((userData) => {
    setUser(userData);
    setAuthError(null);
    try {
      if (userData) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(userData));
        syncDashboardSession(userData);
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
        syncDashboardSession(null);
      }
    } catch (e) {
      logAuthError("setAuth localStorage", e);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const apiUser = await getCurrentUser();
      setAuth(apiUser || null);
    } catch (err) {
      logAuthError("refreshUser", err);
    }
  }, [setAuth]);

  const logout = useCallback(async () => {
    try {
      await logoutApi();
    } catch (e) {
      logAuthError("logout", e);
    }
    setUser(null);
    setAuthError(null);
    try {
      localStorage.removeItem(STORAGE_KEY_USER);
      syncDashboardSession(null);
    } catch (e) {
      logAuthError("logout localStorage", e);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const storedUser = (() => {
        try {
          const raw = localStorage.getItem(STORAGE_KEY_USER);
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      try {
        const apiUser = await getCurrentUser();
        if (cancelled) return;
        if (apiUser) {
          setUser(apiUser);
          setAuthError(null);
          try {
            localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(apiUser));
            syncDashboardSession(apiUser);
          } catch (e) {
            logAuthError("init localStorage set", e);
          }
        } else {
          setUser(null);
          setAuthError(null);
          try {
            localStorage.removeItem(STORAGE_KEY_USER);
            syncDashboardSession(null);
          } catch (e) {
            logAuthError("init localStorage remove", e);
          }
        }
      } catch (err) {
        if (cancelled) return;
        logAuthError("getCurrentUser", err);
        setAuthError(err?.message ?? "Erreur de connexion");
        setUser(null);
        try {
          localStorage.removeItem(STORAGE_KEY_USER);
        } catch (e) {}
      } finally {
        if (!cancelled) setIsInitialized(true);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = {
    user,
    isAuthenticated,
    isInitialized,
    authError,
    setAuth,
    refreshUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
