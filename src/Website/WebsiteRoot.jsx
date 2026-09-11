import { useEffect } from "react";
import websiteCss from "@website/index.scss?url";
import {
  WebsiteLayout,
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
} from "@website/App.jsx";
import Home from "@website/pages/Home";
import Services from "@website/pages/Services";
import Pricing from "@website/pages/Pricing";
import Contact from "@website/pages/Contact";
import AuthCallback from "@website/pages/AuthCallback";
import MonEspace from "@website/pages/MonEspace";
import MentionsLegales from "@website/pages/MentionsLegales";
import PolitiqueConfidentialite from "@website/pages/PolitiqueConfidentialite";
import ServiceIATelephonique from "@website/pages/ServiceIATelephonique";
import FonctionnalitesPrevues from "@website/pages/FonctionnalitesPrevues";
import Onboarding from "@website/pages/Onboarding";
import PlatformAdmin from "@website/pages/PlatformAdmin";
import ProtectedRoute from "@website/components/Auth/ProtectedRoute";

export function useWebsiteStyles() {
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = websiteCss;
    link.dataset.theme = "website";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);
}

export function StyledWebsiteLayout() {
  useWebsiteStyles();
  return <WebsiteLayout />;
}

export {
  WebsiteProviders,
  LoginRedirect,
  GoogleCallbackRedirect,
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
