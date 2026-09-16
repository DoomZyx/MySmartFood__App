import AppLayout from "../../Components/Layout/AppLayout";
import { useCreateCall } from "../../Hooks/CreateCall/useCreateCall";
import "./CreateCall.scss";

function CreateCall() {
  // Utiliser le hook qui contient toute la logique
  const {
    formData,
    loading,
    success,
    error,
    typesDemande,
    servicesOptions,
    handleInputChange,
    handleSubmit,
    handleReset,
  } = useCreateCall();

  return (
    <AppLayout>
      <div className="create-call-container">
        {success && (
          <div className="notification-toast success-message">
            <i className="bi bi-check-circle-fill"></i>
            <span className="message-content">Appel créé avec succès !</span>
          </div>
        )}

        {error && (
          <div className="notification-toast error-message">
            <i className="bi bi-exclamation-triangle-fill"></i>
            <span className="message-content">{error}</span>
          </div>
        )}

        <div className="form-card">
          <h2>📞 Créer un Nouvel Appel</h2>
          <form onSubmit={handleSubmit}>
            {/* Informations de contact */}
            <div className="form-section">
              <h3>Informations de contact</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Nom *</label>
                  <input
                    type="text"
                    name="nom"
                    value={formData.nom}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Téléphone *</label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="form-group">
                  <label>Adresse</label>
                  <input
                    type="text"
                    name="adresse"
                    value={formData.adresse}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Nom de l'entreprise</label>
                <input
                  type="text"
                  name="entrepriseName"
                  value={formData.entrepriseName}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Détails de l'appel */}
            <div className="form-section">
              <h3>Détails de l'appel</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Type de demande *</label>
                  <select
                    name="type_demande"
                    value={formData.type_demande}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Sélectionner...</option>
                    {typesDemande.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Services</label>
                  <select
                    name="services"
                    value={formData.services}
                    onChange={handleInputChange}
                  >
                    <option value="">Sélectionner...</option>
                    {servicesOptions.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  rows="4"
                  placeholder="Détails de la demande..."
                />
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="form-actions">
              <button
                type="button"
                onClick={handleReset}
                className="btn-reset"
                disabled={loading}
              >
                Réinitialiser
              </button>
              <button
                type="submit"
                className="btn-submit"
                disabled={loading}
              >
                {loading ? "Création..." : "Créer l'appel"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}

export default CreateCall;

