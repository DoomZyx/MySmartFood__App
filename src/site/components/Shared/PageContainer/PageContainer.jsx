import React from "react";
import "./PageContainer.scss";

const PageContainer = ({ children, className = "" }) => {
  return (
    <div className={`page-container ${className}`}>
      {children}
    </div>
  );
};

export default PageContainer; 