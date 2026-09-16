import React from "react";
import FeatureCard from "../FeatureCard/FeatureCard";
import "./FeaturesGrid.scss";

const FeaturesGrid = ({ features, variant = "default", columns = 4 }) => {
  return (
    <div className={`features-grid features-grid--${columns}-cols`}>
      {features.map((feature, index) => (
        <FeatureCard
          key={index}
          icon={feature.icon}
          title={feature.title}
          description={feature.description}
          delay={index * 0.1}
          variant={variant}
        />
      ))}
    </div>
  );
};

export default FeaturesGrid; 