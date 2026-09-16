import React from "react";
import "./Section.scss";

const Section = ({ children, className = "", variant = "default" }) => {
  return (
    <section className={`section ${variant} ${className}`}>
      <div className="container">
        {children}
      </div>
    </section>
  );
};

export default Section; 