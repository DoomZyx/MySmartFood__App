import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageContainer, Hero, Section } from "../components";
import { useAuth } from "../hooks/useAuth";
import { useCheckout } from "../hooks/useCheckout";
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

  const { startBetaAccess, createCheckoutSession } = useCheckout();
  const email = user?.email || "";

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
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasPlanId) {
    return (
      <PageContainer>
        <Hero
          title="Avant de continuer"
          gradientText="mySmartFood"
          description="Un abonnement beta unique est créé pour votre restaurant. Le paiement passe par Stripe en mode test, puis vous renseignez l'établissement."
        />
        <Section variant="alt">
          <div className="onboarding-card">
            <h2 className="onboarding-title">Paiement test Stripe</h2>
            <p className="onboarding-text">
              L&apos;établissement est d&apos;abord provisionné (accès beta). Vous êtes
              ensuite redirigé vers Stripe Checkout en sandbox. Vous pourrez
              renseigner les informations du restaurant dans Mon espace.
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
                onClick={handleContinueToCheckout}
              >
                {isSubmitting
                  ? "Redirection vers Stripe..."
                  : "Continuer vers le paiement"}
              </button>
            </div>
          </div>
        </Section>
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
            l&apos;application mySmartFood.
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
