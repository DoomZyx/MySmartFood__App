import React from "react";
import { motion } from "framer-motion";
import { Users, ClipboardList, Heart } from "lucide-react";
import { useOptimizedAnimation } from "../../../hooks/useOptimizedAnimation";
import "./HomeFeatures.scss";

function HomeFeatureCard({ feature, delay }) {
  const animationProps = useOptimizedAnimation(delay);

  return (
    <motion.div {...animationProps} className="feature-card">
      <div className="feature-icon">{feature.icon}</div>
      <h3 className="feature-title">{feature.title}</h3>
      <p className="feature-description">{feature.description}</p>
    </motion.div>
  );
}

const HomeFeatures = () => {
  const features = [
    {
      icon: <Users className="icon" />,
      title: "La salle reste prioritaire",
      description:
        "Plus besoin d'interrompre un service pour décrocher. L'équipe se concentre sur les tables, l'assistant gère la ligne.",
    },
    {
      icon: <ClipboardList className="icon" />,
      title: "Commandes et réservations posées",
      description:
        "L'assistant prend l'appel, connaît votre carte, et écrit la commande ou la réservation dans l'application. Vous pilotez, sans courir.",
    },
    {
      icon: <Heart className="icon" />,
      title: "Moins de stress, clients mieux servis",
      description:
        "Ceux en salle ont toute l'attention. Ceux au téléphone ont une réponse. Productivité et satisfaction, sans charger le personnel.",
    },
  ];

  const headerAnimation = useOptimizedAnimation(0);

  return (
    <section className="features-section">
      <div className="features-content">
        <motion.div {...headerAnimation} className="features-header">
          <h2 className="features-title">
            On ne vend pas un robot.{" "}
            <span className="text-gradient">On rend le service tenable.</span>
          </h2>
          <p className="features-description">
            L&apos;application centralise commandes et réservations. L&apos;assistant
            vocal tient la ligne. Le personnel priorise la salle, en sérénité.
          </p>
        </motion.div>

        <div className="features-grid">
          {features.map((feature, index) => (
            <HomeFeatureCard key={feature.title} feature={feature} delay={index * 0.08} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HomeFeatures;
