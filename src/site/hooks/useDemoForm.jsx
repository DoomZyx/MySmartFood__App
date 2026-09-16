import { useState } from 'react';

import { apiBaseUrl } from "../services/apiBase";

const API_BASE_URL = apiBaseUrl();

export const useDemoForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const submitDemoForm = async (formData) => {
    if (!API_BASE_URL) throw new Error("API non configurée");
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch(`${API_BASE_URL}/api/demo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erreur lors de l\'envoi de la demande de démo');
      }

      setSuccess(true);
      return data;

    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setError(null);
    setSuccess(false);
  };

  return { submitDemoForm, isLoading, error, success, resetForm };
}; 