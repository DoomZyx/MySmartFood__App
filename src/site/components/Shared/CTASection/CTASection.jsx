import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import "./CTASection.scss";

const CTASection = ({
  title,
  description,
  gradientText,
  primaryButton,
  secondaryButton,
}) => {
  const { openDemoModal } = useDemoModal();
  const navigate = useNavigate();
  const animationProps = useOptimizedAnimation(0);

  const handleSecondaryClick = () => {
    if (secondaryButton === "Parler à un expert") {
      navigate("/contact");
    } else {
      openDemoModal();
    }
  };

  return (
    <section className="cta-section">
      <div className="container">
        <motion.div {...animationProps} className="cta-content">
          <div className="cta-card">
            <h2 className="cta-title">
              {title}
              {gradientText && (
                <span className="text-gradient">{gradientText}</span>
              )}
            </h2>
            <p className="cta-description">{description}</p>
            <div className="cta-buttons">
              {primaryButton && (
                <button className="btn btn-primary" onClick={openDemoModal}>
                  {primaryButton}
                </button>
              )}
              {secondaryButton && (
                <button className="btn btn-secondary" onClick={handleSecondaryClick}>
                  {secondaryButton}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
