/**
 * Transformateur de données utilisateurs
 * Formate les données utilisateur pour les réponses API
 */
export class UserTransformer {
  /**
   * Transforme un utilisateur pour la réponse API
   * @param {Object} user - Utilisateur à transformer
   * @returns {Object} Utilisateur formaté
   */
  static transformUser(user) {
    if (!user) return null;

    // Utiliser la méthode toPublicJSON si disponible
    if (typeof user.toPublicJSON === 'function') {
      return user.toPublicJSON();
    }

    // Sinon formater manuellement
    return {
      id: user.id || user._id,
      username: user.username || user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      avatar: user.avatar || user.avatarUrl,
      telephone: user.telephone || user.phone || "",
      poste: user.poste || user.jobTitle || "",
      departement: user.departement || user.department || "",
      lastLogin: user.lastLogin || user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.tenantId || null,
      tenantName: user.tenantName || null,
    };
  }

  /**
   * Transforme une liste d'utilisateurs
   * @param {Array} users - Liste d'utilisateurs
   * @returns {Array} Utilisateurs formatés
   */
  static transformUserList(users) {
    return users.map(user => this.transformUser(user));
  }

  /**
   * Formate une réponse d'authentification réussie
   * @param {Object} user - Utilisateur
   * @param {string} token - Token JWT
   * @returns {Object} Réponse formatée
   */
  static authSuccessResponse(user, token) {
    return {
      success: true,
      message: "Connexion réussie",
      data: {
        user: this.transformUser(user),
        token
      }
    };
  }

  /**
   * Formate une réponse d'inscription réussie
   * @param {Object} user - Utilisateur créé
   * @param {string} token - Token JWT
   * @returns {Object} Réponse formatée
   */
  static registrationSuccessResponse(user, token) {
    return {
      success: true,
      message: "Utilisateur créé avec succès",
      data: {
        user: this.transformUser(user),
        token
      }
    };
  }

  /**
   * Formate une réponse de profil
   * @param {Object} user - Utilisateur
   * @returns {Object} Réponse formatée
   */
  static profileResponse(user) {
    return {
      success: true,
      data: {
        user: this.transformUser(user)
      }
    };
  }

  /**
   * Formate une réponse de mise à jour de profil
   * @param {Object} user - Utilisateur mis à jour
   * @returns {Object} Réponse formatée
   */
  static profileUpdateResponse(user) {
    return {
      success: true,
      message: "Profil mis à jour avec succès",
      data: {
        user: this.transformUser(user)
      }
    };
  }

  /**
   * Formate une réponse d'upload d'avatar
   * @param {string} avatarUrl - URL de l'avatar
   * @param {Object} user - Utilisateur mis à jour
   * @returns {Object} Réponse formatée
   */
  static avatarUploadResponse(avatarUrl, user) {
    return {
      success: true,
      message: "Avatar uploadé avec succès",
      data: {
        avatar: avatarUrl,
        user: this.transformUser(user)
      }
    };
  }

  /**
   * Formate une réponse de liste d'utilisateurs
   * @param {Array} users - Liste d'utilisateurs
   * @returns {Object} Réponse formatée
   */
  static usersListResponse(users) {
    return {
      success: true,
      data: this.transformUserList(users)
    };
  }

  /**
   * Formate une réponse de mise à jour d'utilisateur (admin)
   * @param {Object} user - Utilisateur mis à jour
   * @returns {Object} Réponse formatée
   */
  static userUpdateResponse(user) {
    return {
      success: true,
      message: "Utilisateur mis à jour avec succès",
      data: this.transformUser(user)
    };
  }

  /**
   * Formate une réponse de suppression d'utilisateur
   * @returns {Object} Réponse formatée
   */
  static userDeleteResponse() {
    return {
      success: true,
      message: "Utilisateur supprimé avec succès"
    };
  }

  /**
   * Formate une réponse d'erreur
   * @param {string} error - Message d'erreur
   * @returns {Object} Réponse d'erreur formatée
   */
  static errorResponse(error) {
    return {
      success: false,
      error
    };
  }

  /**
   * Formate une réponse de statistiques utilisateurs
   * @param {Object} stats - Statistiques
   * @returns {Object} Réponse formatée
   */
  static statsResponse(stats) {
    return {
      success: true,
      data: stats
    };
  }
}

