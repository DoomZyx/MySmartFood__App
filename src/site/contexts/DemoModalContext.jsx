import React, { createContext, useContext, useState } from "react";

const DemoModalContext = createContext();

export const useDemoModal = () => {
  const context = useContext(DemoModalContext);
  if (!context) {
    throw new Error("useDemoModal must be used within a DemoModalProvider");
  }
  return context;
};

export const DemoModalProvider = ({ children }) => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  const openDemoModal = () => {
    setIsDemoModalOpen(true);
  };

  const closeDemoModal = () => {
    setIsDemoModalOpen(false);
  };

  const value = {
    isDemoModalOpen,
    openDemoModal,
    closeDemoModal,
  };

  return (
    <DemoModalContext.Provider value={value}>
      {children}
    </DemoModalContext.Provider>
  );
};
