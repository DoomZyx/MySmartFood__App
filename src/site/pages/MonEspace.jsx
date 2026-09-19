import React, { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, LayoutDashboard } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { PageContainer, Hero, Section } from "../components";
import RestaurateurProfilForm from "../components/RestaurateurProfil/RestaurateurProfilForm";
import OnboardingNoticeModal from "../components/Shared/OnboardingNoticeModal/OnboardingNoticeModal";
import { useAuth } from "../hooks/useAuth";
import { useMonEspaceBilling } from "../hooks/useMonEspaceBilling";
import { usePricingData } from "../hooks/usePricingData";
import { canOpenDashboard } from "../services/syncDashboardSession";
import { dashboardHomeHref } from "../utils/dashboardPath";
import {
  canOpenCompanyDossierForm,
  canResumeCompanyDossier,
  clearPaidPendingDossier,
  isDeveloperUser,
  markPaidPendingDossier,
  stillNeedsPayment,
} from "@shared/companyOnboarding";
import { getAccountStatus } from "../utils/accountStatus";
import "./MonEspace.scss";

const MonEspace = () => {
  const { user, refreshUser } = useAuth();
  const { syncState, error: billingError, startBetaCheckout, isLoading: isPaying } =
    useMonEspaceBilling();
  const { visiblePlans } = usePricingData();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const paymentConfirmed = Boolean(user?.hasActiveSubscription);
  const isDeveloper = isDeveloperUser(user);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const accountStatus = getAccountStatus(user);
  const hasAppAccess = canOpenDashboard(user);
  const needsPayment = !isDeveloper && stillNeedsPayment(user) && !paymentConfirmed;
  const needsDossier = canResumeCompanyDossier(user);
  const pendingReview =
    !isDeveloper &&
    (user?.onboardingStatus === "pending_review" ||
      (Boolean(user?.twilioDocsSubmittedAt) && !hasAppAccess));
  const showCompanySteps = Boolean(user);

  const [companyFormStep, setCompanyFormStep] = useState(1);
  const [establishmentReady, setEstablishmentReady] = useState(false);
  const skipStepScroll = useRef(true);

  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  useEffect(() => {
    if (isDeveloper) {
      clearPaidPendingDossier();
      return;
    }
    if (checkoutSuccess && user?.id) {
      markPaidPendingDossier(user.id);
    }
  }, [checkoutSuccess, isDeveloper, user?.id]);

  useEffect(() => {
    if (isDeveloper || user?.twilioDocsSubmittedAt || hasAppAccess) {
      clearPaidPendingDossier();
      return;
    }
    if (user?.hasActiveSubscription || user?.onboardingStatus === "needs_dossier") {
      markPaidPendingDossier(user.id);
    }
  }, [
    isDeveloper,
    user?.id,
    user?.hasActiveSubscription,
    user?.onboardingStatus,
    user?.twilioDocsSubmittedAt,
    hasAppAccess,
  ]);

  const scrollToId = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const goToCompanyStep = useCallback((step) => {
    setCompanyFormStep(step);
  }, []);

  useEffect(() => {
    if (skipStepScroll.current) {
      skipStepScroll.current = false;
      return;
    }
    scrollToId(companyFormStep === 2 ? "dossier-form" : "etablissement-form");
  }, [companyFormStep, scrollToId]);

  useEffect(() => {
    if (isDeveloper || !user?.id || !user?.hasActiveSubscription) return;
    markPaidPendingDossier(user.id);
    if (checkoutSuccess || syncState === "ok") {
      setShowCheckoutModal(true);
    }
  }, [isDeveloper, syncState, user?.hasActiveSubscription, user?.id, checkoutSuccess]);

  const closeCheckoutModal = () => {
    setShowCheckoutModal(false);
    if (checkoutSuccess) {
      searchParams.delete("checkout");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
    goToCompanyStep(establishmentReady ? 2 : 1);
  };

  const payBeta = async () => {
    const planId = visiblePlans[0]?.id || 6;
    try {
      await startBetaCheckout(planId);
    } catch {
      // error already exposed by useMonEspaceBilling
    }
  };

  return (
    <PageContainer>
      <Hero
        title="Mon "
        gradientText="espace"
        description={
          isDeveloper
            ? "Compte développeur : le paiement et la validation client ne sont pas exigés. Vous pouvez renseigner l'établissement et le dossier entreprise pour utiliser les fonctionnalités."
            : "Le tableau de bord s'ouvre après paiement, dépôt du formulaire d'entreprise, puis validation de votre dossier."
        }
      />
      <Section variant="alt">
        <div className="mon-espace-form-wrapper">
          {showCompanySteps ? (
            <ol className="mon-espace-steps">
              <li
                className={!needsPayment ? "is-done" : "is-current"}
                role="button"
                tabIndex={0}
                onClick={() => scrollToId("mon-espace-paiement")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    scrollToId("mon-espace-paiement");
                  }
                }}
              >
                Paiement
              </li>
              <li
                className={
                  pendingReview || hasAppAccess
                    ? "is-done"
                    : companyFormStep === 2 || needsDossier
                      ? "is-current"
                      : ""
                }
                role="button"
                tabIndex={0}
                onClick={() => goToCompanyStep(2)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    goToCompanyStep(2);
                  }
                }}
              >
                Formulaire d&apos;entreprise
              </li>
              <li className={hasAppAccess ? "is-done" : pendingReview ? "is-current" : ""}>
                Validation
              </li>
              <li className={hasAppAccess ? "is-done" : ""}>Tableau de bord</li>
            </ol>
          ) : null}

          <div id="mon-espace-paiement" className="mon-espace-subscription">
            <CreditCard className="mon-espace-subscription-icon" />
            <div>
              <h3 className="mon-espace-subscription-title">Votre statut</h3>
              <p className="mon-espace-subscription-value">{accountStatus.label}</p>
              <p className="mon-espace-subscription-detail">{accountStatus.detail}</p>
            </div>
            {needsPayment ? (
              <button
                type="button"
                className="mon-espace-instance-required-btn"
                disabled={isPaying}
                onClick={payBeta}
              >
                {isPaying ? "Redirection..." : "Payer la beta"}
              </button>
            ) : null}
          </div>

          {hasAppAccess && (
            <div className="mon-espace-app-access">
              <LayoutDashboard className="mon-espace-app-access-icon" />
              <div className="mon-espace-app-access-content">
                <h3 className="mon-espace-app-access-title">
                  Application mySmartFood
                </h3>
                <p className="mon-espace-app-access-desc">
                  {isDeveloper
                    ? "Votre accès développeur est ouvert. Accédez au tableau de bord, commandes et réservations."
                    : "Votre dossier a été validé. Accédez au tableau de bord, commandes et réservations."}
                </p>
                <a href={dashboardHomeHref()} className="mon-espace-app-access-link">
                  Ouvrir l&apos;application
                </a>
              </div>
            </div>
          )}

          {needsPayment && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Paiement requis
                </h3>
                <p className="mon-espace-instance-required-desc">
                  Réglez l&apos;abonnement beta Stripe (150 €/mois). Ensuite, remplissez le
                  formulaire ci-dessous. Le tableau de bord reste fermé tant
                  que le dossier n&apos;est pas validé.
                </p>
                {billingError ? (
                  <p className="mon-espace-instance-required-desc">{billingError}</p>
                ) : null}
                <button
                  type="button"
                  className="mon-espace-instance-required-btn"
                  disabled={isPaying}
                  onClick={payBeta}
                >
                  {isPaying ? "Redirection..." : "Payer la beta — 150 €/mois"}
                </button>
              </div>
            </div>
          )}

          {needsDossier && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Formulaire d&apos;inscription d&apos;entreprise
                </h3>
                <p className="mon-espace-instance-required-desc">
                  {isDeveloper
                    ? "Renseignez l'établissement, le SIRET (ou SIREN) et les pièces ci-dessous. Le paiement et la validation client ne sont pas exigés, mais ces champs sont nécessaires pour exercer les fonctionnalités restaurant."
                    : "Reprenez le formulaire ci-dessous : établissement, SIRET (ou SIREN), pièce d'identité recto/verso et justificatif d'adresse. Vous pouvez quitter et revenir, les champs déjà enregistrés sont conservés. Sans ce dossier validé, le tableau de bord n'apparaît pas."}
                </p>
              </div>
            </div>
          )}

          {pendingReview && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Dossier en cours de vérification
                </h3>
                <p className="mon-espace-instance-required-desc">
                  Vos pièces ont bien été transmises. L&apos;équipe vérifie que
                  les informations correspondent. En attendant, vous pouvez
                  prendre rendez-vous pour une démonstration via le formulaire
                  de contact.
                </p>
                <Link
                  to="/contact?intent=demo#contact-form"
                  className="mon-espace-instance-required-btn"
                >
                  Prendre rendez-vous pour une démo
                </Link>
              </div>
            </div>
          )}

          <h2 id="etablissement-form" className="mon-espace-form-title">
            {companyFormStep === 2 && canOpenCompanyDossierForm(user)
              ? "Pièces du dossier entreprise"
              : "Informations de l'établissement"}
          </h2>
          <p className="mon-espace-form-intro">
            {isDeveloper
              ? "Consultez et mettez à jour les informations de l'établissement, le SIRET et les pièces. Aucune validation de dossier n'est requise."
              : "Consultez et mettez à jour les informations de l'établissement, le SIRET et les pièces. Vous pouvez les enregistrer avant le paiement."}
          </p>
          <RestaurateurProfilForm
            companyFormStep={companyFormStep}
            onCompanyFormStepChange={goToCompanyStep}
            onEstablishmentReadyChange={setEstablishmentReady}
          />
        </div>
      </Section>
      <OnboardingNoticeModal
        isOpen={showCheckoutModal}
        title="Paiement reçu : une étape reste obligatoire"
        confirmLabel="Remplir le formulaire"
        hideCancel
        onCancel={closeCheckoutModal}
        onConfirm={closeCheckoutModal}
      >
        <p>
          Le paiement a bien été enregistré. Il ne donne pas encore accès au
          tableau de bord.
        </p>
        <p>
          Remplissez maintenant le formulaire d&apos;inscription d&apos;entreprise
          ci-dessous, avec toutes les pièces. Nous vérifions ensuite que chaque
          information correspond, puis nous validons l&apos;accès.
        </p>
      </OnboardingNoticeModal>
    </PageContainer>
  );
};

export default MonEspace;
