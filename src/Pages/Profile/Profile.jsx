import AppLayout from "../../Components/Layout/AppLayout";
import "./Profile.scss";
import { useProfile } from "../../Hooks/Profile/useProfile";

function Profile() {
  const {
    profileData,
    editMode,
    tempData,
    saving,
    success,
    handleEdit,
    handleCancel,
    handleSave,
    handleAvatarUpload,
    handleInputChange,
    formatDate,
    formatDateTime,
    loading,
    error,
    setError,
  } = useProfile();

  if (loading) {
    return (
      <AppLayout>
        <div className="loading-state">
          <i className="bi bi-repeat spinning"></i>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="my-profile-container">
        {error && (
          <div className="error-message">
            <i className="bi bi-exclamation-triangle"></i>
            {error}
            <button type="button" onClick={() => setError(null)} aria-label="Fermer">×</button>
          </div>
        )}
        {success && (
          <div className="success-message">
            <i className="bi bi-check-circle-fill"></i>
            Profil mis à jour avec succès !
          </div>
        )}
        <div className="profile-content">
          <div className="profile-card">
            <div className="profile-info">
              <div className="avatar-section">
                <div className="avatar">
                  {profileData.avatar ? (
                    <img src={profileData.avatar} alt="Avatar" />
                  ) : (
                    <i className="bi bi-person-fill"></i>
                  )}
                </div>
                <label className="change-avatar">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAvatarUpload(file);
                      e.target.value = "";
                    }}
                    disabled={saving}
                  />
                  <i className="bi bi-camera-fill"></i>
                  Changer la photo
                </label>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <label>Nom complet</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={tempData.nom}
                      onChange={(e) => handleInputChange("nom", e.target.value)}
                      placeholder="Votre nom complet"
                    />
                  ) : (
                    <span>{profileData.nom}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>Email professionnel</label>
                  {editMode ? (
                    <input
                      type="email"
                      value={tempData.email}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      placeholder="votre.email@handlehome.fr"
                    />
                  ) : (
                    <span>{profileData.email}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>Téléphone</label>
                  {editMode ? (
                    <input
                      type="tel"
                      value={tempData.telephone}
                      onChange={(e) => handleInputChange("telephone", e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                    />
                  ) : (
                    <span>{profileData.telephone}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>Poste</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={tempData.poste}
                      onChange={(e) => handleInputChange("poste", e.target.value)}
                      placeholder="Votre poste"
                    />
                  ) : (
                    <span>{profileData.poste}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>Département</label>
                  {editMode ? (
                    <select
                      value={tempData.departement || ""}
                      onChange={(e) => handleInputChange("departement", e.target.value)}
                    >
                      <option value="Service Client">Service Client</option>
                      <option value="Support Technique">Support Technique</option>
                      <option value="Ventes">Ventes</option>
                      <option value="Administration">Administration</option>
                    </select>
                  ) : (
                    <span>{profileData.departement}</span>
                  )}
                </div>
                <div className="info-item">
                  <label>Membre depuis</label>
                  <span>{formatDate(profileData.dateCreation)}</span>
                </div>
                <div className="info-item">
                  <label>Dernière connexion</label>
                  <span>{formatDateTime(profileData.derniereConnexion)}</span>
                </div>
              </div>
            </div>
            <div className="profile-actions">
              {!editMode ? (
                <button type="button" onClick={handleEdit} className="edit-btn">
                  <i className="bi bi-pencil-square"></i>
                  Modifier
                </button>
              ) : (
                <div className="edit-actions">
                  <button type="button" onClick={handleCancel} className="cancel-btn">
                    <i className="bi bi-x-circle"></i>
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="save-btn"
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <i className="bi bi-arrow-repeat spinning"></i>
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle"></i>
                        Sauvegarder
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default Profile;
