import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useLogin } from "../../Hooks/Login/useLogin";
import fd from "../../assets/fd.jpg";
import "./Login.scss";

function Login() {
  const { t } = useTranslation();
  const {
    formData,
    setFormData,
    loading,
    setLoading,
    error,
    setError,

    handleInputChange,
    handleSubmit,
    handleGoogle,
  } = useLogin();

  return (
    <div className="login-container">
      <img className="login-wallpaper" src={fd} alt="" />
      <div className="login-card">
        <div className="login-header">
          <h1>{t('login.title')}</h1>
          <p>{t('login.subtitle')}</p>
        </div>

        {error && (
          <div className="notification-toast error-message">
            <i className="bi bi-exclamation-triangle"></i>
            <span className="message-content">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form" autoComplete="on">
          <div className="form-group">
            <label htmlFor="email">{t('login.email')}</label>
            <input
              type="email"
              id="email"
              name="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder={t('login.emailPlaceholder')}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder={t('login.passwordPlaceholder')}
              required
            />
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <i className="bi bi-arrow-repeat spinning"></i>
                {t('login.loggingIn')}
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right"></i>
                {t('login.loginButton')}
              </>
            )}
          </button>
          <div className="form-group">
            <button type="button" className="login-btn" disabled={loading} onClick={handleGoogle}>
              <i className="bi bi-google"></i>
              {t("login.googleButton")}
            </button>
          </div>
        </form>
        <p>
          <Link to="/register">{t("login.createAccount")}</Link>
          {" · "}
          <Link to="/">{t("login.backToSite")}</Link>
        </p>
      </div>
    </div>
  );
}

export default Login; 