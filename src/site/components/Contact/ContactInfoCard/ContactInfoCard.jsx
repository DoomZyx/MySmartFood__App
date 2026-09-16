import React from "react";
import { motion } from "framer-motion";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./ContactInfoCard.scss";

const ContactInfoCard = ({ icon, title, value, description, delay = 0 }) => {
  const animationProps = useOptimizedAnimation(delay);

  return (
    <motion.div {...animationProps} className="contact-info-card">
      <div className="contact-icon">
        <div className="icon-wrapper">{icon}</div>
      </div>
      <h3 className="contact-title">{title}</h3>
      <p className="contact-value">{value}</p>
      <p className="contact-description">{description}</p>
    </motion.div>
  );
};

export default ContactInfoCard;
