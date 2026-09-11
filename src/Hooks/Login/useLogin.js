import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { loginUser, isAuthenticated, getCurrentUser } from "../../API/auth";
import { postAuthPath } from "../../utils/postAuthPath";

export function useLogin() {
 const { t } = useTranslation();
 const [formData, setFormData] = useState({
  email: "",
  password: "",
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
const navigate = useNavigate();
const location = useLocation();

useEffect(() => {
  if (new URLSearchParams(location.search).get("error") === "auth_failed") {
    setError(t("login.googleFailed"));
  }
}, [location.search, t]);

useEffect(() => {
  if (isAuthenticated()) {
    navigate(postAuthPath(getCurrentUser(), location.state?.from), { replace: true });
  }
}, [navigate, location.state, location.key]);

const handleGoogle = () => {
  const base = import.meta.env.VITE_API_URL || "/";
  window.location.href = `${base}api/auth/google?return=site`;
};

const handleInputChange = (e) => {
  const { name, value } = e.target;
  setFormData((prev) => ({
    ...prev,
    [name]: value,
  }));
};

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  try {
    const session = await loginUser(formData.email, formData.password);
    navigate(postAuthPath(session, location.state?.from), { replace: true });
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
return {
 // UseState
 formData,
 setFormData,
 loading,
 setLoading,
 error,
 setError,
// Fonctions
 handleInputChange,
 handleSubmit,
 handleGoogle,

}
}