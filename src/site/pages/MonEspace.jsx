import React, { useEffect, useState } from "react";
import { CreditCard, LayoutDashboard } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { PageContainer, Hero, Section } from "../components";
import RestaurateurProfilForm from "../components/RestaurateurProfil/RestaurateurProfilForm";
import OnboardingNoticeModal from "../components/Shared/OnboardingNoticeModal/OnboardingNoticeModal";
import { useAuth } from "../hooks/useAuth";
import { useMonEspaceBilling } from "../hooks/useMonEspaceBilling";
import { usePricingData } from "../hooks/usePricingData";
import { canOpenDashboard } from "../services/syncDashboardSession";
import { dashboardHomeHref } from "../utils/dashboardPath";
import {
  canResumeCompanyDossier,
  clearPaidPendingDossier,
  markPaidPendingDossier,
  stillNeedsPayment,
} from "@shared/companyOnboarding";
import "./MonEspace.scss";

const MonEspace = () => {
  const { user, refreshUser } = useAuth();
  const { syncState, error: billingError } = useMonEspaceBilling();
  const { plans } = usePricingData();
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutSuccess = searchParams.get("checkout") === "success";
  const paymentConfirmed = Boolean(user?.hasActiveSubscription);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);

  const subscriptionLabel =
    user?.planName ||
    (user?.planId ? plans.find((p) => p.id === user.planId)?.name : null) ||
    user?.subscriptionPlan ||
    null;
  const displaySubscription = subscriptionLabel || "Aucun abonnement actif";
  const hasAppAccess = canOpenDashboard(user);
  const needsPayment = stillNeedsPayment(user) && !paymentConfirmed;
  const needsDossier = canResumeCompanyDossier(user);
  const pendingReview =
    user?.onboardingStatus === "pending_review" ||
    (Boolean(user?.twilioDocsSubmittedAt) && !hasAppAccess);

  useEffect(() => {
    refreshUser?.();
  }, [refreshUser]);

  useEffect(() => {
    if (user?.twilioDocsSubmittedAt || hasAppAccess) {
      clearPaidPendingDossier();
      return;
    }
    if (user?.hasActiveSubscription || user?.onboardingStatus === "needs_dossier") {
      markPaidPendingDossier(user.id);
      return;
    }
    if (user?.onboardingStatus === "needs_payment" || user?.onboardingStatus === "none") {
      clearPaidPendingDossier();
    }
  }, [
    user?.id,
    user?.hasActiveSubscription,
    user?.onboardingStatus,
    user?.twilioDocsSubmittedAt,
    hasAppAccess,
  ]);

  useEffect(() => {
    if (!user?.id || !user?.hasActiveSubscription) return;
    markPaidPendingDossier(user.id);
    if (checkoutSuccess || syncState === "ok") {
      setShowCheckoutModal(true);
    }
  }, [syncState, user?.hasActiveSubscription, user?.id, checkoutSuccess]);

  const closeCheckoutModal = () => {
    setShowCheckoutModal(false);
    if (checkoutSuccess) {
      searchParams.delete("checkout");
      searchParams.delete("session_id");
      setSearchParams(searchParams, { replace: true });
    }
    document.getElementById("etablissement-form")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <PageContainer>
      <Hero
        title="Mon "
        gradientText="espace"
        description="Le tableau de bord s'ouvre après paiement, dépôt du formulaire d'entreprise, puis validation de votre dossier."
      />
      <Section variant="alt">
        <div className="mon-espace-form-wrapper">
          <ol className="mon-espace-steps">
            <li className={!needsPayment ? "is-done" : "is-current"}>Paiement</li>
            <li
              className={
                pendingReview || hasAppAccess ? "is-done" : needsDossier ? "is-current" : ""
              }
            >
              Formulaire d&apos;entreprise
            </li>
            <li className={hasAppAccess ? "is-done" : pendingReview ? "is-current" : ""}>
              Validation
            </li>
            <li className={hasAppAccess ? "is-done" : ""}>Tableau de bord</li>
          </ol>

          <div className="mon-espace-subscription">
            <CreditCard className="mon-espace-subscription-icon" />
            <div>
              <h3 className="mon-espace-subscription-title">
                Votre abonnement
              </h3>
              <p className="mon-espace-subscription-value">
                {displaySubscription}
              </p>
            </div>
          </div>

          {hasAppAccess && (
            <div className="mon-espace-app-access">
              <LayoutDashboard className="mon-espace-app-access-icon" />
              <div className="mon-espace-app-access-content">
                <h3 className="mon-espace-app-access-title">
                  Application mySmartFood
                </h3>
                <p className="mon-espace-app-access-desc">
                  Votre dossier a été validé. Accédez au tableau de bord,
                  commandes et réservations.
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
                  Réglez l&apos;abonnement Stripe. Ensuite, remplissez le
                  formulaire ci-dessous. Le tableau de bord reste fermé tant
                  que le dossier n&apos;est pas validé.
                </p>
                {billingError ? (
                  <p className="mon-espace-instance-required-desc">{billingError}</p>
                ) : null}
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
                  Reprenez le formulaire ci-dessous : établissement, SIRET (ou
                  SIREN), pièce d&apos;identité recto/verso et justificatif
                  d&apos;adresse. Vous pouvez quitter et revenir, les champs
                  déjà enregistrés sont conservés. Sans ce dossier validé, le
                  tableau de bord n&apos;apparaît pas.
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
                  les informations correspondent. Le lien Tableau de bord
                  s&apos;affichera ici dès que le dossier est accepté.
                </p>
              </div>
            </div>
          )}

          <h2 id="etablissement-form" className="mon-espace-form-title">
            Informations de l&apos;établissement
          </h2>
          <p className="mon-espace-form-intro">
            Ces données et pièces sont contrôlées avant l&apos;ouverture du
            tableau de bord et l&apos;achat du numéro Twilio.
          </p>
          <RestaurateurProfilForm />
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
