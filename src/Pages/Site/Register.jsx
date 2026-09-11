import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SiteLayout from "./SiteLayout";
import { useRegister } from "../../Hooks/Site/useRegister";
import "./Register.scss";

function Register() {
  const { t } = useTranslation();
  const { formData, loading, error, handleInputChange, handleSubmit } = useRegister();

  return (
    <SiteLayout>
      <section className="site-register">
        <h1>{t("site.register.title")}</h1>
        <p>{t("site.register.subtitle")}</p>
        {error && <p className="site-register__error">{error}</p>}
        <form onSubmit={handleSubmit} autoComplete="on">
          <label htmlFor="name">{t("site.register.name")}</label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            autoComplete="name"
          />
          <label htmlFor="email">{t("login.email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleInputChange}
            autoComplete="email"
            required
          />
          <label htmlFor="password">{t("login.password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleInputChange}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? t("site.register.submitting") : t("site.register.submit")}
          </button>
        </form>
        <p>
          {t("site.register.hasAccount")} <Link to="/login">{t("site.nav.login")}</Link>
        </p>
      </section>
    </SiteLayout>
  );
}

export default Register;
