import React from "react";
import { motion } from "framer-motion";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./Hero.scss";

const Hero = ({ title, description, gradientText, children = null }) => {
  const heroAnimation = useOptimizedAnimation(0, "fadeUp", { mount: true });

  return (
    <section className="hero">
      <div className="container">
        <motion.div {...heroAnimation} className="hero-content">
          <h1 className="hero-title">
            {title}
            {gradientText && (
              <span className="text-gradient">{gradientText}</span>
            )}
          </h1>
          <p className="hero-description">{description}</p>
          {children}
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
