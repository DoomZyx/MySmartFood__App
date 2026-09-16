import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import websiteCss from "@site/index.scss?url";
import { DASHBOARD_PATH } from "@shared/dashboardPath";
import {
  WebsiteLayout,
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
} from "@site/App.jsx";
import Home from "@site/pages/Home";
import Services from "@site/pages/Services";
import Pricing from "@site/pages/Pricing";
import Contact from "@site/pages/Contact";
import AuthCallback from "@site/pages/AuthCallback";
import MonEspace from "@site/pages/MonEspace";
import MentionsLegales from "@site/pages/MentionsLegales";
import PolitiqueConfidentialite from "@site/pages/PolitiqueConfidentialite";
import ServiceIATelephonique from "@site/pages/ServiceIATelephonique";
import FonctionnalitesPrevues from "@site/pages/FonctionnalitesPrevues";
import Onboarding from "@site/pages/Onboarding";
import PlatformAdmin from "@site/pages/PlatformAdmin";
import ProtectedRoute from "@site/components/Auth/ProtectedRoute";

const DASHBOARD_ROUTE_PREFIXES = [
  DASHBOARD_PATH,
  "/profile",
  "/orders",
  "/reservations",
  "/configuration",
  "/monitoring",
  "/admin",
];

export function isDashboardPath(pathname) {
  return DASHBOARD_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function useWebsiteStyles() {
  const { pathname } = useLocation();
  const onDashboard = isDashboardPath(pathname);

  useLayoutEffect(() => {
    if (onDashboard) {
      document.querySelectorAll('link[data-theme="website"]').forEach((node) => node.remove());
      return undefined;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = websiteCss;
    link.dataset.theme = "website";
    document.head.appendChild(link);
    return () => link.remove();
  }, [onDashboard]);
}

export function StyledWebsiteLayout() {
  useWebsiteStyles();
  return <WebsiteLayout />;
}

export {
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
  Home,
  Services,
  Pricing,
  Contact,
  AuthCallback,
  MonEspace,
  MentionsLegales,
  PolitiqueConfidentialite,
  ServiceIATelephonique,
  FonctionnalitesPrevues,
  Onboarding,
  PlatformAdmin,
  ProtectedRoute,
};
