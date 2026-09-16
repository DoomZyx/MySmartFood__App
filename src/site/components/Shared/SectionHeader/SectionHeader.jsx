import React from "react";
import { motion } from "framer-motion";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./SectionHeader.scss";

const SectionHeader = ({ title, gradientText, description, delay = 0 }) => {
  const animationProps = useOptimizedAnimation(delay);

  return (
    <motion.div {...animationProps} className="section-header">
      <h2 className="section-title">
        {title}
        {gradientText && <span className="text-gradient">{gradientText}</span>}
      </h2>
      {description && <p className="section-description">{description}</p>}
    </motion.div>
  );
};

export default SectionHeader;
