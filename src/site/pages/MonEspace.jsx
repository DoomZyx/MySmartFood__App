import React from "react";
import { CreditCard, LayoutDashboard } from "lucide-react";
import { PageContainer, Hero, Section } from "../components";
import RestaurateurProfilForm from "../components/RestaurateurProfil/RestaurateurProfilForm";
import { useAuth } from "../hooks/useAuth";
import { usePricingData } from "../hooks/usePricingData";
import { canOpenDashboard } from "../services/syncDashboardSession";
import { dashboardHomeHref } from "../utils/dashboardPath";
import "./MonEspace.scss";

const MonEspace = () => {
  const { user } = useAuth();
  const { plans } = usePricingData();

  const subscriptionLabel =
    user?.planName ||
    (user?.planId ? plans.find((p) => p.id === user.planId)?.name : null) ||
    user?.subscriptionPlan ||
    null;
  const displaySubscription = subscriptionLabel || "Aucun abonnement actif";
  const hasAppAccess = canOpenDashboard(user);
  const hasTenant = Boolean(user?.smartcrmInstanceId || user?.planSlug || user?.hasActiveSubscription);
  const needsPayment = hasTenant && !user?.hasActiveSubscription;
  const needsDossier = hasTenant && !user?.twilioDocsSubmittedAt;

  return (
    <PageContainer>
      <Hero
        title="Mon "
        gradientText="espace"
        description="Consultez votre abonnement et transmettez les pièces demandées. Le tableau de bord reste fermé tant que le paiement Stripe et le dossier ne sont pas complets."
      />
      <Section variant="alt">
        <div className="mon-espace-form-wrapper">
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
                  Accédez à votre tableau de bord, commandes et réservations.
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
                  Le tableau de bord s&apos;ouvre seulement après un abonnement
                  Stripe réglé. Choisissez une offre dans Tarifs pour payer.
                </p>
              </div>
            </div>
          )}

          {needsDossier && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Dossier Twilio et coordonnées
                </h3>
                <p className="mon-espace-instance-required-desc">
                  Joignez le KBIS (ou équivalent), la pièce d&apos;identité du
                  dirigeant recto et verso, une preuve d&apos;adresse de
                  l&apos;établissement (moins de 3 mois), et décrivez l&apos;usage
                  prévu du numéro. Formats : PDF ou image. Sans ce dossier, le
                  tableau de bord reste fermé.
                </p>
              </div>
            </div>
          )}

          <h2 className="mon-espace-form-title">
            Informations de l&apos;établissement
          </h2>
          <p className="mon-espace-form-intro">
            Ces données sont nécessaires pour l&apos;achat du numéro Twilio et
            la configuration de votre restaurant. Elles seront synchronisées
            avec votre application une fois celle-ci activée.
          </p>
          <RestaurateurProfilForm />
        </div>
      </Section>
    </PageContainer>
  );
};

export default MonEspace;
