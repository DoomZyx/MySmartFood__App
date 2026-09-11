import {
 isAdmin,
 getAllUsers,
 createUser,
 updateUser,
 deleteUser,
} from "../../API/auth";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function useAdmin() {
 const navigate = useNavigate();
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [successMessage, setSuccessMessage] = useState("");

 const [showUserModal, setShowUserModal] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
 const [newUserForm, setNewUserForm] = useState({
   username: "",
   email: "",
   password: "",
   role: "user",
 });

 // Vérification de sécurité - Rediriger si pas admin
 useEffect(() => {
  if (!isAdmin()) {
    navigate("/app");
    return;
  }

  // Chargement initial des données
  loadUsers();

  // Mise à jour périodique
  const interval = setInterval(() => {
  }, 30000); // Toutes les 30 secondes

  return () => clearInterval(interval);
}, [navigate]);

const loadUsers = async () => {
  try {
    setLoading(true);
    const response = await getAllUsers();
    setUsers(Array.isArray(response?.data) ? response.data : []);
  } catch (err) {
    setError(err.message);
    setUsers([]);
  } finally {
    setLoading(false);
  }
};

// Gestion des utilisateurs
const handleUserSubmit = async (e) => {
  e.preventDefault();
  try {
    if (editingUser) {
      await updateUser(editingUser.id, newUserForm);
      setSuccessMessage("Utilisateur modifié avec succès !");
    } else {
      await createUser(newUserForm);
      setSuccessMessage("Utilisateur créé avec succès !");
    }
    
    setShowUserModal(false);
    setEditingUser(null);
    setNewUserForm({ username: "", email: "", password: "", role: "user" });
    loadUsers();
    setTimeout(() => setSuccessMessage(""), 3000);
  } catch (err) {
    setError(err.message);
  }
};

const handleEditUser = (user) => {
  setEditingUser(user);
  setNewUserForm({
    username: user.username,
    email: user.email,
    password: "",
    role: user.role,
  });
  setShowUserModal(true);
};

const handleDeleteUser = async (userId) => {
  if (window.confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
    try {
      await deleteUser(userId);
      setSuccessMessage("Utilisateur supprimé avec succès !");
      loadUsers();
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch (err) {
      setError(err.message);
    }
  }
};

const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
  return {
   users,
   loading,
   error,
   setError,
   successMessage,
   showUserModal,
   setShowUserModal,
   editingUser,
   setEditingUser,
   newUserForm,
   setNewUserForm,
   handleUserSubmit,
   handleEditUser,
   handleDeleteUser,
   formatDateTime,
  }
}