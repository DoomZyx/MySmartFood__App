import React from "react";

/**
 * Error Boundary au niveau racine : capture les erreurs non gérées des composants enfants,
 * affiche une UI de fallback et log l'erreur (en dev ; en prod un service type Sentry pourrait être branché).
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    if (import.meta.env.DEV && typeof console !== "undefined" && console.error) {
      console.error("[ErrorBoundary]", error, errorInfo?.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            Une erreur est survenue
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            Nous nous en excusons. Vous pouvez rafraîchir la page ou revenir à l&apos;accueil.
          </p>
          <a href="/" style={{ textDecoration: "underline" }}>
            Retour à l&apos;accueil
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
