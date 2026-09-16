import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Header from "./components/Header/Header";
import Footer from "./components/Footer/Footer";
import CookieBanner from "./components/Shared/CookieBanner/CookieBanner";
import ScrollToTop from "./components/Shared/ScrollToTop/ScrollToTop";
import DemoModal from "./components/Shared/DemoModal/DemoModal";
import LoginModal from "./components/Shared/LoginModal/LoginModal";
import ProtectedRoute from "./components/Auth/ProtectedRoute";
import { DemoModalProvider, useDemoModal } from "./contexts/DemoModalContext";
import { LoginModalProvider, useLoginModal } from "./contexts/LoginModalContext";
import { AuthProvider } from "./contexts/AuthContext";
import { AnimationProvider } from "./components/Shared/AnimationProvider/AnimationProvider";
import ErrorBoundary from "./components/Shared/ErrorBoundary/ErrorBoundary";
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
import { PLATFORM_ADMIN_PATH } from "./utils/platformAdminPath";
import { openDashboard } from "./utils/dashboardPath";
import { apiBaseUrl } from "./services/apiBase";

function DashboardEntry() {
  const navigate = useNavigate();
  useEffect(() => {
    openDashboard(navigate);
  }, [navigate]);
  return <div>Redirection...</div>;
}

function redirectToApi(pathWithSearch) {
  const apiBase = apiBaseUrl();
  if (!apiBase) return;
  const target = `${apiBase}${pathWithSearch}`;
  try {
    if (new URL(target).origin === window.location.origin) return;
  } catch {
    return;
  }
  window.location.assign(target);
}

/** Redirige vers le callback backend si Google a renvoyé l'utilisateur sur le frontend. */
export function GoogleCallbackRedirect() {
  useEffect(() => {
    redirectToApi(`/api/auth/google/callback${window.location.search}`);
  }, []);
  return <div>Redirection...</div>;
}

/** Evite que la SPA avale /api/auth/google et redirige vers /login. */
export function GoogleStartRedirect() {
  useEffect(() => {
    const search = window.location.search || "?return=site";
    redirectToApi(`/api/auth/google${search}`);
  }, []);
  return <div>Redirection...</div>;
}

/** /login : ouvre la modale de connexion avec intent (planId, from) puis redirige vers /. */
export function LoginRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openLoginModal } = useLoginModal();

  useEffect(() => {
    const planIdParam = searchParams.get("planId");
    const planId = planIdParam ? parseInt(planIdParam, 10) : undefined;
    openLoginModal({
      planId: Number.isInteger(planId) ? planId : undefined,
      from: location.state?.from,
    });
    navigate("/", { replace: true });
  }, [location.state?.from, searchParams, openLoginModal, navigate]);

  return null;
}

export function WebsiteLayout() {
  const { isDemoModalOpen, closeDemoModal } = useDemoModal();
  const { isLoginModalOpen, closeLoginModal } = useLoginModal();

  return (
    <div className="App">
      <ScrollToTop />
      <Header />
      <Outlet />
      <Footer />
      <CookieBanner />
      <DemoModal isOpen={isDemoModalOpen} onClose={closeDemoModal} />
      <LoginModal isOpen={isLoginModalOpen} onClose={closeLoginModal} />
    </div>
  );
}

export function WebsiteProviders({ children }) {
  return (
    <ErrorBoundary>
      <AnimationProvider>
        <AuthProvider>
          <DemoModalProvider>
            <LoginModalProvider>{children}</LoginModalProvider>
          </DemoModalProvider>
        </AuthProvider>
      </AnimationProvider>
    </ErrorBoundary>
  );
}

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
        <Route path={PLATFORM_ADMIN_PATH} element={<PlatformAdmin />} />
        <Route path="/app" element={<DashboardEntry />} />
      </Route>
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
