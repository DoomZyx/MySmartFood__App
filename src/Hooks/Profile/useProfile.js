import { useState, useEffect } from "react";
import { getProfile, updateUserProfile, uploadAvatar as uploadAvatarAPI } from "../../API/auth";

export function useProfile() {
  const [profileData, setProfileData] = useState({
    nom: "",
    email: "",
    telephone: "",
    poste: "",
    departement: "",
    avatar: null,
    dateCreation: "",
    derniereConnexion: new Date().toISOString(),
  });

  const [editMode, setEditMode] = useState(false);
  const [tempData, setTempData] = useState({ ...profileData });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [statsPersonnelles] = useState({
    totalAppelsTraites: 147,
    tempsResponseMoyen: 2.5,
    satisfactionClient: 96,
    appelsMoisCourant: 23,
  });

  // Charger les données du profil au montage
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getProfile();
      if (response.success && response.data?.user) {
        const user = response.data.user;
        const formattedData = {
          nom: user.username || "",
          email: user.email || "",
          telephone: user.telephone || "",
          poste: user.poste || "",
          departement: user.departement || "",
          avatar: user.avatar || null,
          dateCreation: user.createdAt || "",
          derniereConnexion: user.lastLogin || new Date().toISOString(),
        };
        setProfileData(formattedData);
        setTempData(formattedData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setTempData({ ...profileData });
  };

  const handleCancel = () => {
    setEditMode(false);
    setTempData({ ...profileData });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      // Préparer les données à envoyer (mapper nom -> username)
      const updateData = {
        username: tempData.nom,
        email: tempData.email,
        telephone: tempData.telephone,
        poste: tempData.poste,
        departement: tempData.departement,
        avatar: tempData.avatar,
      };

      const response = await updateUserProfile(updateData);

      if (response.success) {
        await loadProfile();

        const currentUser = JSON.parse(localStorage.getItem("user"));
        if (currentUser) {
          currentUser.username = updateData.username;
          currentUser.email = updateData.email;
          currentUser.telephone = updateData.telephone;
          currentUser.poste = updateData.poste;
          currentUser.departement = updateData.departement;
          localStorage.setItem("user", JSON.stringify(currentUser));
        }

        setEditMode(false);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file) => {
    try {
      setSaving(true);
      setError(null);

      const response = await uploadAvatarAPI(file);

      if (response.success) {
        await loadProfile();

        const avatar = response.data?.user?.avatar ?? response.data?.avatar;
        const currentUser = JSON.parse(localStorage.getItem("user"));
        if (currentUser && avatar) {
          currentUser.avatar = avatar;
          localStorage.setItem("user", JSON.stringify(currentUser));
        }

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

const handleInputChange = (field, value) => {
  setTempData((prev) => ({
    ...prev,
    [field]: value,
  }));
};

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatDateTime = (dateString) => {
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};
  return {
    profileData,
    setProfileData,
    editMode,
    setEditMode,
    tempData,
    setTempData,
    saving,
    setSaving,
    loading,
    error,
    setError,
    success,
    setSuccess,
    statsPersonnelles,
    loadProfile,
    handleEdit,
    handleCancel,
    handleSave,
    handleAvatarUpload,
    handleInputChange,
    formatDate,
    formatDateTime
  };
}