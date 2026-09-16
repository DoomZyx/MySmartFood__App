import React from "react";
import "./FAQCard.scss";

const FAQCard = ({ question, answer }) => {
  return (
    <div className="faq-card">
      <h3 className="faq-question">{question}</h3>
      <p className="faq-answer">{answer}</p>
    </div>
  );
};

export default FAQCard; 