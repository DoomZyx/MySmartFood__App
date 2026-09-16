import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Star, Sparkles, Clock } from "lucide-react";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import { useLoginModal } from "../../../contexts/LoginModalContext";
import { useAuth } from "../../../hooks/useAuth";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import { useCheckout } from "../../../hooks/useCheckout";
import "./PricingCard.scss";

const PricingCard = ({ plan, delay = 0 }) => {
  const navigate = useNavigate();
  const animationProps = useOptimizedAnimation(delay, "fadeUp");
  const { openDemoModal } = useDemoModal();
  const { openLoginModal } = useLoginModal();
  const { isAuthenticated } = useAuth();
  const { createCheckoutSession, isLoading, error } = useCheckout();

  const handleCheckout = () => {
    if (!isAuthenticated) {
      openLoginModal({ planId: plan.id });
      return;
    }
    navigate(`/onboarding?planId=${plan.id}`);
  };

  return (
    <motion.div
      {...animationProps}
      className={`pricing-card ${plan.popular ? "popular" : ""}`}
    >
      {plan.popular && (
        <div className="popular-badge">
          <div className="badge-content">
            <Star className="icon" />
            Le plus populaire
          </div>
        </div>
      )}

      {plan.isNew && (
        <div className="new-badge">
          <div className="badge-content">
            <Sparkles className="icon" />
            Nouveau
          </div>
        </div>
      )}

      {plan.isDevelopment && (
        <div className="development-badge">
          <div className="badge-content">
            <Clock className="icon" />
            En développement
          </div>
        </div>
      )}

      <div className="pricing-header">
        <h3 className="pricing-title">{plan.name}</h3>
        <p className="pricing-description">{plan.description}</p>

        <div className="pricing-price">
          <span className="price-amount">
            {plan.price}
            {plan.priceSuffix != null && (
              <span className="price-suffix">{plan.priceSuffix}</span>
            )}
          </span>
          {plan.period && (
            <div className="maintenance-price">{plan.period}</div>
          )}
          {plan.minutes != null && (
            <>
              <div className="pricing-minutes">{plan.minutes} min / mois</div>
              <div className="pricing-calls">
                ~{plan.callsCount} appels (3 min)
              </div>
            </>
          )}
          {plan.API && <div className="API-price">{plan.API}</div>}
        </div>

        <div className="pricing-actions">
          <button
            type="button"
            className="btn pricing-btn btn-primary"
            onClick={handleCheckout}
            disabled={isLoading}
          >
            {isLoading ? "Redirection..." : "Acheter"}
          </button>
          {error && (
            <p className="pricing-checkout-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={openDemoModal}
            className="btn pricing-btn btn-secondary"
          >
            Demander une démonstration
          </button>
        </div>
      </div>

      <div className="pricing-features">
        <h4 className="pricing-title">Inclus dans ce plan :</h4>
        {plan.features.map((feature, featureIndex) => (
          <div key={featureIndex} className="feature-item">
            <Check className="check-icon" />
            <span className="feature-text">{feature}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

export default PricingCard;
