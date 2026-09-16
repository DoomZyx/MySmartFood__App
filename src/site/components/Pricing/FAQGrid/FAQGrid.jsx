import React from "react";
import FAQCard from "../FAQCard/FAQCard";
import "./FAQGrid.scss";

const FAQGrid = ({ faqs }) => {
  return (
    <div className="faq-grid">
      {faqs.map((faq, index) => (
        <FAQCard key={index} question={faq.question} answer={faq.answer} />
      ))}
    </div>
  );
};

export default FAQGrid; 