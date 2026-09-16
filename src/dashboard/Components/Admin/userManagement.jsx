import { useTranslation } from "react-i18next";

function UserManagement({
 users,
 loading,
 formatDateTime,
 handleEditUser,
 handleDeleteUser,
 setShowUserModal,
}) {
 const { t } = useTranslation();

 return (
<div className="users-section">
<div className="users-table">
  <table>
    <thead>
      <tr>
        <th>{t('admin.username')}</th>
        <th>{t('login.email')}</th>
        <th>{t('admin.role')}</th>
        <th>{t('admin.status')}</th>
        <th>{t('admin.lastLogin')}</th>
        <th>{t('admin.actions')}</th>
      </tr>
    </thead>
    <tbody>
      {users.map((user, index) => (
        <tr key={user.id ?? user._id ?? `user-${index}`}>
          <td>{user.username}</td>
          <td>{user.email}</td>
          <td>
            <span className={`role ${user.role}`}>
              {user.role.toUpperCase()}
            </span>
          </td>
          <td>
            <span
              className={`status ${
                user.isActive ? "active" : "inactive"
              }`}
            >
              {user.isActive ? t('admin.active') : t('admin.inactive')}
            </span>
          </td>
          <td>
            {user.lastLogin
              ? formatDateTime(user.lastLogin)
              : t('admin.never')}
          </td>
          <td className="actions">
            <button
              onClick={() => handleEditUser(user)}
              className="btn-edit"
              title={t('common.edit')}
            >
              <i className="bi bi-pencil"></i>
            </button>
            <button
              onClick={() => handleDeleteUser(user.id ?? user._id)}
              className="btn-delete"
              title={t('common.delete')}
            >
              <i className="bi bi-trash"></i>
            </button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>

<div className="section-footer">
  <button
    onClick={() => setShowUserModal(true)}
    className="btn-primary"
  >
    <i className="bi bi-person-plus"></i>
    {t('admin.addUser')}
  </button>
</div>
</div>
 )
}

export default UserManagement

