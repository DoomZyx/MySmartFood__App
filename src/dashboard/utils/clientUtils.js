/**
 * Utilitaires pour formater et afficher les données clients
 */

/**
 * Retourne le nom complet formaté d'un client ou d'une commande
 * @param {Object} client - L'objet client
 * @param {Object} order - L'objet order (optionnel) qui peut contenir un champ nom
 * @returns {string} Le nom complet formaté
 */
export function getClientFullName(client, order = null) {
  // Si pas de client, vérifier si le nom est dans la commande (order.nom)
  if (!client && order && order.nom) {
    return order.nom;
  }
  
  if (!client) return 'Client inconnu';
  
  // Si nomComplet existe (virtual du backend)
  if (client.nomComplet) {
    return client.nomComplet;
  }
  
  // Sinon, construire manuellement
  const { prenom, nom } = client;
  if (!prenom && !nom) return 'Client inconnu';
  
  // Si nom est juste un point ou vide, retourner seulement le prénom
  if (nom === '.' || !nom || nom.trim() === '') {
    return prenom;
  }
  
  return `${prenom} ${nom}`;
}

/**
 * Retourne le téléphone formaté d'un client
 * @param {Object} client - L'objet client
 * @returns {string} Le téléphone formaté
 */
export function getClientPhone(client) {
  if (!client || !client.telephone) return 'Non fourni';
  
  // Si telephoneDisplay existe (virtual du backend)
  if (client.telephoneDisplay) {
    return client.telephoneDisplay;
  }
  
  // Sinon, vérifier manuellement
  const { telephone } = client;
  
  // Si c'est un code technique généré (commence par NF_)
  if (telephone.startsWith('NF_')) {
    return 'Non fourni';
  }
  
  return telephone;
}

/**
 * Retourne les initiales d'un client pour l'affichage
 * @param {Object} client - L'objet client
 * @returns {string} Les initiales (ex: "JD" pour Jean Dupont)
 */
export function getClientInitials(client) {
  if (!client) return '?';
  
  const fullName = getClientFullName(client);
  const parts = fullName.split(' ').filter(p => p.length > 0);
  
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


