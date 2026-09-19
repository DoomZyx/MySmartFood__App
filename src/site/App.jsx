import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import Home from "./pages/Home";
import Services from "./pages/Services";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import AuthCallback from "./pages/AuthCallback";
import MonEspace from "./pages/MonEspace";
import MentionsLegales from "./pages/MentionsLegales";
import PolitiqueConfidentialite from "./pages/PolitiqueConfidentialite";
import ServiceIATelephonique from "./pages/ServiceIATelephonique";
import FonctionnalitesPrevues from "./pages/FonctionnalitesPrevues";
import Onboarding from "./pages/Onboarding";
import PlatformAdmin from "./pages/PlatformAdmin";
import {
  DashboardEntry,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
  LoginRedirect,
  WebsiteLayout,
  WebsiteProviders,
} from "./WebsiteChrome.jsx";

export {
  DashboardEntry,
  GoogleCallbackRedirect,
  GoogleStartRedirect,
  LoginRedirect,
  WebsiteLayout,
  WebsiteProviders,
};

function AppContent() {
  return (
    <Routes>
      <Route element={<WebsiteLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/services" element={<Services />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/tarifs" element={<Navigate to="/pricing" replace />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/mentions-legales" element={<MentionsLegales />} />
        <Route path="/politique-confidentialite" element={<PolitiqueConfidentialite />} />
        <Route path="/service-ia-telephonique" element={<ServiceIATelephonique />} />
        <Route path="/fonctionnalites-prevues" element={<FonctionnalitesPrevues />} />
        <Route path="/login" element={<LoginRedirect />} />
        <Route path="api/auth/google" element={<GoogleStartRedirect />} />
        <Route path="/api/auth/google" element={<GoogleStartRedirect />} />
        <Route path="api/auth/callback" element={<AuthCallback />} />
        <Route path="/api/auth/google/callback" element={<GoogleCallbackRedirect />} />
        <Route
          path="/mon-espace"
          element={
            <ProtectedRoute>
              <MonEspace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        <Route path="/app" element={<DashboardEntry />} />
      </Route>
      <Route path="/bf-admin" element={<PlatformAdmin />} />
      <Route path="/x/bXlzbWFydGZvb2QtcGxhdGZvcm0tYWRtaW4" element={<PlatformAdmin />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <WebsiteProviders>
        <AppContent />
      </WebsiteProviders>
    </Router>
  );
}

export default App;
