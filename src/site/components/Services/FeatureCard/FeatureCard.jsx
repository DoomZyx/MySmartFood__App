import React from "react";
import { motion } from "framer-motion";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./FeatureCard.scss";

const FeatureCard = ({
  icon,
  title,
  description,
  delay = 0,
  variant = "default",
}) => {
  const animationProps = useOptimizedAnimation(delay);

  return (
    <motion.div {...animationProps} className={`feature-card ${variant}`}>
      <div className="feature-icon">
        <div className="icon-wrapper">{icon}</div>
      </div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-description">{description}</p>
    </motion.div>
  );
};

export default FeatureCard;
