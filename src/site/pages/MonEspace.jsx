import React, { useState } from "react";
import { CreditCard, LayoutDashboard } from "lucide-react";
import { PageContainer, Hero, Section } from "../components";
import RestaurateurProfilForm from "../components/RestaurateurProfil/RestaurateurProfilForm";
import { useAuth } from "../hooks/useAuth";
import { usePricingData } from "../hooks/usePricingData";
import { resendAccessEmailApi } from "../services/authService";
import { canOpenDashboard } from "../services/syncDashboardSession";
import { dashboardHomeHref } from "../utils/dashboardPath";
import "./MonEspace.scss";

const MonEspace = () => {
  const { user } = useAuth();
  const { plans } = usePricingData();
  const [resendError, setResendError] = useState("");
  const [resendOk, setResendOk] = useState(false);
  const [resending, setResending] = useState(false);

  const subscriptionLabel =
    user?.planName ||
    (user?.planId ? plans.find((p) => p.id === user.planId)?.name : null) ||
    user?.subscriptionPlan ||
    null;
  const displaySubscription = subscriptionLabel || "Aucun abonnement actif";
  const hasAppAccess = canOpenDashboard(user);
  const hasTenant = Boolean(user?.smartcrmInstanceId || user?.planSlug || user?.hasActiveSubscription);
  const waitingForToken = Boolean(user?.hasActiveSubscription) && !hasAppAccess;
  const dossierPending = hasTenant && Boolean(user?.twilioDocsSubmittedAt) && !hasAppAccess;
  const needsDossier = hasTenant && !user?.twilioDocsSubmittedAt;

  return (
    <PageContainer>
      <Hero
        title="Mon "
        gradientText="espace"
        description="Consultez votre abonnement, transmettez les pièces pour Twilio et les coordonnées de votre restaurant. L&apos;accès à l&apos;application sera activé après traitement manuel par notre équipe."
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

          {waitingForToken && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Lien d&apos;accès
                </h3>
                <p className="mon-espace-instance-required-desc">
                  Un e-mail avec un lien d&apos;accès a été envoyé après le paiement.
                  Ouvrez-le pour activer le tableau de bord.
                </p>
                {resendOk && (
                  <p className="mon-espace-instance-required-desc">
                    Un nouveau lien a été envoyé.
                  </p>
                )}
                {resendError && (
                  <p className="mon-espace-instance-required-desc">{resendError}</p>
                )}
                <button
                  type="button"
                  className="mon-espace-app-access-link"
                  disabled={resending}
                  onClick={async () => {
                    setResendError("");
                    setResendOk(false);
                    setResending(true);
                    try {
                      await resendAccessEmailApi();
                      setResendOk(true);
                    } catch (err) {
                      setResendError(err.message);
                    } finally {
                      setResending(false);
                    }
                  }}
                >
                  {resending ? "Envoi..." : "Renvoyer le lien d'accès"}
                </button>
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
                  prévu du numéro. Formats : PDF ou image. Après validation vous
                  recevrez un e-mail : le lien vers l&apos;app sera disponible
                  ici.
                </p>
              </div>
            </div>
          )}

          {dossierPending && (
            <div className="mon-espace-instance-required">
              <LayoutDashboard className="mon-espace-instance-required-icon" />
              <div className="mon-espace-instance-required-content">
                <h3 className="mon-espace-instance-required-title">
                  Dossier en cours de traitement
                </h3>
                <p className="mon-espace-instance-required-desc">
                  Nous avons bien reçu vos documents. Notre équipe finalise la
                  configuration Twilio et votre instance. Vous recevrez un
                  e-mail dès que l&apos;application sera accessible depuis cet
                  espace (délai indicatif : 14 jours ouvrés maximum). Vous
                  pouvez toujours mettre à jour vos coordonnées ci-dessous.
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
