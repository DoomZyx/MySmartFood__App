import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Linkedin, Twitter, Facebook } from "lucide-react";
import { useOptimizedAnimation } from "../../hooks/useOptimizedAnimation";
import "./Footer.scss";

const Footer = () => {
  const animationProps = useOptimizedAnimation(0, "fadeUp");

  return (
    <footer className="footer">
      <div className="container">
        <motion.div {...animationProps} className="footer-content">
          <div className="footer-section">
            <div className="footer-logo">
              <h3>mySmartFood</h3>
              <p>L'accueil téléphonique des restaurateurs, 24/7, par l'IA</p>
            </div>
            <div className="footer-social">
              <a href="#" className="social-link">
                <Linkedin className="icon" />
              </a>
              <a href="#" className="social-link">
                <Twitter className="icon" />
              </a>
              <a href="#" className="social-link">
                <Facebook className="icon" />
              </a>
            </div>
          </div>

          <div className="footer-section">
            <h4>Navigation</h4>
            <ul className="footer-links">
              <li>
                <Link to="/">Accueil</Link>
              </li>
              <li>
                <Link to="/services">Services</Link>
              </li>
              <li>
                <Link to="/about">À propos</Link>
              </li>
              <li>
                <Link to="/pricing">Tarifs</Link>
              </li>
              <li>
                <Link to="/contact">Contact</Link>
              </li>
              <li>
                <Link to="/fonctionnalites-prevues">
                  Fonctionnalités Prévues
                </Link>
              </li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Services</h4>
            <ul className="footer-links">
              <li>
                <Link to="/service-ia-telephonique">IA Téléphonique</Link>
              </li>
            </ul>
          </div>

          <div className="footer-section">
            <h4>Contact</h4>
            <div className="contact-info">
              <div className="contact-item">
                <Mail className="icon" />
                <span>contact.smartcrm@gmail.com</span>
              </div>
              <div className="contact-item">
                <Phone className="icon" />
                <span>+33 7 49 34 55 10</span>
              </div>
              <div className="contact-item">
                <MapPin className="icon" />
                <span>Knutange, France</span>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="footer-bottom">
          <p>&copy; 2025 SmartCRM. Tous droits réservés.</p>
          <div className="footer-legal">
            <Link to="/mentions-legales">Mentions légales</Link>
            <Link to="/politique-confidentialite">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
