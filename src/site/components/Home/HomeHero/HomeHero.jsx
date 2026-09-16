import React from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useDemoModal } from "../../../contexts/DemoModalContext";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./HomeHero.scss";

const HomeHero = () => {
  const { openDemoModal } = useDemoModal();
  const heroAnimation = useOptimizedAnimation(0, "fadeUp", { mount: true });

  const stats = [
    { number: "24/7", label: "L'assistant décroche" },
    { number: "0", label: "Table lâchée pour le téléphone" },
    { number: "100%", label: "Attention à la salle" },
  ];

  const scrollToRoi = () => {
    document.getElementById("simulateur-roi")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <section className="hero-section">
      {/* Background Effects */}
      <div className="hero-background"></div>

      {/* Animated Background Elements */}
      <div className="hero-effects">
        <div className="effect-1"></div>
        <div className="effect-2"></div>
      </div>

      <div className="hero-content">
        <motion.div {...heroAnimation} className="hero-container">
          <h1 className="hero-title">
            La salle d&apos;abord.
            <span className="text-gradient"> L&apos;assistant s&apos;occupe du téléphone.</span>
          </h1>

          <p className="hero-description">
            Pendant le service, votre équipe reste avec les clients. Un assistant
            vocal prend les commandes et les réservations, les pose dans
            l&apos;application, et vous laisse prioriser la salle — moins de
            stress, plus de clients satisfaits.
          </p>

          <div className="hero-cta">
            <button className="btn btn-primary" onClick={openDemoModal}>
              Demander une démonstration
              <ArrowRight className="icon" />
            </button>
            <button type="button" className="btn btn-secondary" onClick={scrollToRoi}>
              Estimer mon CA perdu
            </button>
          </div>

          {/* Stats */}
          <div className="hero-stats">
            {stats.map((stat, index) => (
              <div key={index} className="stat-item">
                <div className="stat-number">{stat.number}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default HomeHero;
