import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer, Hero, Section } from "../components";
import { useAuth } from "../hooks/useAuth";
import { useCheckout } from "../hooks/useCheckout";
import OnboardingNoticeModal from "../components/Shared/OnboardingNoticeModal/OnboardingNoticeModal";
import { shouldOpenMonEspace } from "@shared/companyOnboarding";
import "./Onboarding.scss";

const Onboarding = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planIdParam = searchParams.get("planId");
  const planId = planIdParam ? parseInt(planIdParam, 10) : null;
  const hasPlanId = Number.isInteger(planId);

  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCheckoutNotice, setShowCheckoutNotice] = useState(false);

  const { startBetaAccess, createCheckoutSession } = useCheckout();
  const email = user?.email || "";

  useEffect(() => {
    if (shouldOpenMonEspace(user) || user?.accessUnlocked) {
      navigate("/mon-espace", { replace: true });
    }
  }, [user, navigate]);

  const handleGoToSpace = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await startBetaAccess();
      await refreshUser();
      navigate("/mon-espace", { replace: true });
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
      setIsSubmitting(false);
    }
  };

  const handleContinueToCheckout = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await startBetaAccess();
      await refreshUser();
      await createCheckoutSession(planId);
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
      setShowCheckoutNotice(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (shouldOpenMonEspace(user) || user?.accessUnlocked) {
    return null;
  }

  if (hasPlanId) {
    return (
      <PageContainer>
        <Hero
          title="Avant de continuer"
          gradientText="mySmartFood"
          description="Le paiement Stripe ne donne pas encore accès au tableau de bord. Le formulaire d'inscription d'entreprise doit ensuite être rempli, puis validé par notre équipe."
        />
        <Section variant="alt">
          <div className="onboarding-card">
            <h2 className="onboarding-title">Paiement test Stripe</h2>
            <p className="onboarding-text">
              Après le paiement, vous revenez sur Mon espace pour transmettre
              les informations de l&apos;établissement, le SIRET (ou SIREN),
              et les pièces (identité, justificatif d&apos;adresse). L&apos;accès au
              tableau de bord s&apos;ouvre seulement une fois ce dossier
              vérifié et accepté.
            </p>
            <div className="onboarding-form">
              <div className="onboarding-form-group">
                <label htmlFor="onboarding-email">Adresse e-mail</label>
                <input
                  type="email"
                  id="onboarding-email"
                  value={email}
                  readOnly
                  className="onboarding-input-readonly"
                  aria-readonly="true"
                />
              </div>
              {error && (
                <p className="onboarding-form-error" role="alert">
                  {error}
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary onboarding-button"
                disabled={isSubmitting}
                onClick={() => setShowCheckoutNotice(true)}
              >
                Continuer vers le paiement
              </button>
            </div>
          </div>
        </Section>
        <OnboardingNoticeModal
          isOpen={showCheckoutNotice}
          title="Formulaire d'entreprise obligatoire"
          confirmLabel="Je comprends, payer"
          cancelLabel="Retour"
          busy={isSubmitting}
          onCancel={() => setShowCheckoutNotice(false)}
          onConfirm={handleContinueToCheckout}
        >
          <p>
            Le paiement ne débloque pas le tableau de bord. Pour y accéder,
            vous devez ensuite remplir le formulaire d&apos;inscription
            d&apos;entreprise dans Mon espace. Notre équipe vérifie que toutes
            les informations et les pièces correspondent, puis valide le
            dossier.
          </p>
          <p>Pièces à transmettre après le paiement :</p>
          <ul>
            <li>SIRET (14 chiffres) ou, à défaut, SIREN (9 chiffres)</li>
            <li>Pièce d&apos;identité du dirigeant, recto et verso</li>
            <li>Justificatif d&apos;adresse de l&apos;établissement (moins de 3 mois)</li>
            <li>Description de l&apos;usage du numéro professionnel</li>
          </ul>
          <p>
            Tant que le dossier n&apos;est pas validé, le lien Tableau de bord
            reste masqué.
          </p>
        </OnboardingNoticeModal>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Hero
        title="Bienvenue sur "
        gradientText="mySmartFood"
        description="Nous allons utiliser votre compte comme base de votre accès à l'application."
      />
      <Section variant="alt">
        <div className="onboarding-card">
          <h2 className="onboarding-title">Vos identifiants d&apos;accès</h2>
          <p className="onboarding-text">
            Vous êtes connecté avec l&apos;adresse&nbsp;:
          </p>
          <p className="onboarding-email">{email || "votre adresse e-mail"}</p>
          <p className="onboarding-text">
            Lorsque vous continuerez, un accès beta sera créé pour votre restaurant.
            Cette adresse e-mail restera l&apos;identifiant principal de
            l&apos;application mySmartFood. Le tableau de bord reste fermé tant
            que le formulaire d&apos;entreprise n&apos;est pas validé.
          </p>
          {error && (
            <p className="onboarding-form-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary onboarding-button"
            disabled={isSubmitting}
            onClick={handleGoToSpace}
          >
            {isSubmitting ? "Activation de l'accès..." : "Continuer vers mon espace"}
          </button>
        </div>
      </Section>
    </PageContainer>
  );
};

export default Onboarding;
