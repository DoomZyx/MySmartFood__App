import React from "react";
import { Send, Users } from "lucide-react";
import "./ContactBenefits.scss";

const ContactBenefits = () => {
  const benefits = [
    {
      icon: <Send className="icon" />,
      title: "Réponse rapide",
      description: "Nous répondons sous 24h",
    },
    {
      icon: <Users className="icon" />,
      title: "Équipe dédiée",
      description: "Experts à votre service",
    },
  ];

  return (
    <div className="contact-benefits">
      {benefits.map((benefit, index) => (
        <div key={index} className="benefit-item">
          <div
            className={`benefit-icon ${index === 1 ? "benefit-icon-alt" : ""}`}
          >
            {benefit.icon}
          </div>
          <div className="benefit-content">
            <h3 className="benefit-title">{benefit.title}</h3>
            <p className="benefit-description">{benefit.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ContactBenefits;
