import { useTranslation } from "react-i18next";
import AppLayout from "../../Components/Layout/AppLayout";
import "./Admin.scss";
import UserManagement from "../../Components/Admin/userManagement";
import { useAdmin } from "../../Hooks/Admin/useAdmin";

function Admin() {
  const { t } = useTranslation();
  const {
    // État
    users,
    loading,
    error,
    successMessage,
    setError,
    showUserModal,
    setShowUserModal,
    editingUser,
    newUserForm,
    setNewUserForm,
    
    // Fonctions
    formatDateTime,
    handleDeleteUser,
    handleEditUser,
    handleUserSubmit,
  } = useAdmin();

  if (loading && users.length === 0) {
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
      <div className="admin-container">
        {error && (
          <div className="notification-toast error-message">
            <i className="bi bi-exclamation-triangle"></i>
            <span className="message-content">{error}</span>
            <button onClick={() => setError(null)} className="close-btn">
              ×
            </button>
          </div>
        )}

        {successMessage && (
          <div className="notification-toast success-message">
            <i className="bi bi-check-circle"></i>
            <span className="message-content">{successMessage}</span>
          </div>
        )}
        <div className="tab-content">
          {/* Gestion des utilisateurs */}
            <UserManagement
            users={users}
              loading={loading}
              formatDateTime={formatDateTime}
              handleEditUser={handleEditUser}
              handleDeleteUser={handleDeleteUser}
              setShowUserModal={setShowUserModal}
            />
                      </div>

        {/* Modal d'ajout/modification d'utilisateur */}
        {showUserModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowUserModal(false)}
          >
            <div
              className="modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h3>
                  <i className="bi bi-person-gear"></i>
                  {editingUser ? t('common.edit') : t('common.add')} {t('admin.user')}
                </h3>
              </div>

              <form onSubmit={handleUserSubmit} className="user-form">
                <div className="form-group">
                  <label htmlFor="username">{t('admin.username')}</label>
                  <input
                    type="text"
                    id="username"
                    value={newUserForm.username}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, username: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">{t('login.email')}</label>
                  <input
                    type="email"
                    id="email"
                    value={newUserForm.email}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="password">
                    {editingUser ? t('admin.newPasswordOptional') : t('login.password')}
                  </label>
                  <input
                    type="password"
                    id="password"
                    value={newUserForm.password}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, password: e.target.value })
                    }
                    required={!editingUser}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="role">{t('admin.role')}</label>
                  <select
                    id="role"
                    value={newUserForm.role}
                    onChange={(e) =>
                      setNewUserForm({ ...newUserForm, role: e.target.value })
                    }
                    required
                  >
                    <option value="user">{t('admin.roles.user')}</option>
                    <option value="admin">{t('admin.roles.admin')}</option>
                  </select>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="btn-cancel"
                  >
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn-primary">
                    {editingUser ? t('common.edit') : t('common.add')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default Admin;
