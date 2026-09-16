import React, { createContext, useContext, useState, useCallback } from "react";

const LoginModalContext = createContext(null);

export const useLoginModal = () => {
  const context = useContext(LoginModalContext);
  if (!context) {
    throw new Error("useLoginModal must be used within a LoginModalProvider");
  }
  return context;
};

/**
 * @param {Object} intent - Optionnel : { planId?: number, from?: { pathname?: string } }
 */
export const LoginModalProvider = ({ children }) => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loginIntent, setLoginIntent] = useState(null);

  const openLoginModal = useCallback((intent = null) => {
    setLoginIntent(intent || null);
    setIsLoginModalOpen(true);
  }, []);

  const closeLoginModal = useCallback(() => {
    setIsLoginModalOpen(false);
    setLoginIntent(null);
  }, []);

  const value = {
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    loginIntent,
  };

  return (
    <LoginModalContext.Provider value={value}>
      {children}
    </LoginModalContext.Provider>
  );
};
