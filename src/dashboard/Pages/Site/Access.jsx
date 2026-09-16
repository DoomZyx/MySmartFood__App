import { Link } from "react-router-dom";
import { useAccessRedeem } from "../../Hooks/Site/useAccessRedeem";

function Access() {
  const { loading, error } = useAccessRedeem();

  return (
    <section className="site-access" style={{ padding: "4rem 1.5rem", textAlign: "center" }}>
      <h1>Activation de l'accès</h1>
      {loading && <p>Vérification du jeton...</p>}
      {error && (
        <>
          <p>{error}</p>
          <Link to="/login">Connexion</Link>
        </>
      )}
    </section>
  );
}

export default Access;
