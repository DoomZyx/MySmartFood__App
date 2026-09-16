import React from "react";
import PricingCard from "../PricingCard/PricingCard";
import "./PricingGrid.scss";

const PricingGrid = ({ plans }) => {
  return (
    <div className={`pricing-grid${plans.length === 1 ? " pricing-grid--single" : ""}`}>
      {plans.map((plan, index) => (
        <PricingCard key={index} plan={plan} delay={index * 0.1} />
      ))}
    </div>
  );
};

export default PricingGrid;
