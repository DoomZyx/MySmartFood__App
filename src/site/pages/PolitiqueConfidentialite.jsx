import React from "react";
import { PageContainer, Hero, Section, SectionHeader } from "../components";

const PolitiqueConfidentialite = () => {
  return (
    <PageContainer className="service-page">
      <Hero
        title="Politique de "
        gradientText="Confidentialité"
        description="Protection de vos données personnelles et respect de votre vie privée"
      />

      <Section>
        <div className="legal-content">
          <h3>Collecte des données</h3>
          <p>
            Nous collectons uniquement les données nécessaires au bon fonctionnement de nos services :
          </p>
          <ul>
            <li>Informations de contact (nom, email, téléphone)</li>
            <li>Données d'utilisation de nos services</li>
            <li>Données techniques (adresse IP, cookies)</li>
            <li>Données d'appels téléphoniques (pour les utilisateurs de l'IA téléphonique)</li>
          </ul>

          <h3>Utilisation des données</h3>
          <p>
            Vos données sont utilisées exclusivement pour :
          </p>
          <ul>
            <li>Fournir et améliorer nos services</li>
            <li>Gérer votre compte et votre facturation</li>
            <li>Vous contacter concernant nos services</li>
            <li>Assurer la sécurité et la performance de nos systèmes</li>
            <li>Respecter nos obligations légales</li>
          </ul>

          <h3>Protection des données</h3>
          <p>
            Nous mettons en place des mesures de sécurité appropriées pour protéger vos données :
          </p>
          <ul>
            <li>Chiffrement des données en transit et au repos</li>
            <li>Accès restreint aux données personnelles</li>
            <li>Surveillance continue de nos systèmes</li>
            <li>Sauvegardes sécurisées</li>
            <li>Formation de notre équipe à la protection des données</li>
          </ul>

          <h3>Vos droits</h3>
          <p>
            Conformément au RGPD, vous disposez des droits suivants :
          </p>
          <ul>
            <li><strong>Droit d'accès</strong> : Consulter vos données personnelles</li>
            <li><strong>Droit de rectification</strong> : Corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> : Supprimer vos données</li>
            <li><strong>Droit à la portabilité</strong> : Récupérer vos données</li>
            <li><strong>Droit d'opposition</strong> : Refuser le traitement de vos données</li>
            <li><strong>Droit à la limitation</strong> : Limiter le traitement de vos données</li>
          </ul>

          <h3>Cookies</h3>
          <p>
            Notre site utilise des cookies pour améliorer votre expérience :
          </p>
          <ul>
            <li><strong>Cookies techniques</strong> : Nécessaires au fonctionnement du site</li>
            <li><strong>Cookies analytiques</strong> : Mesurer l'audience et les performances</li>
            <li><strong>Cookies de préférences</strong> : Mémoriser vos choix</li>
          </ul>
          <p>
            Vous pouvez désactiver les cookies dans les paramètres de votre navigateur, mais cela peut affecter le fonctionnement du site.
          </p>

          <h3>Partage des données</h3>
          <p>
            Nous ne vendons jamais vos données personnelles. Nous pouvons les partager uniquement avec :
          </p>
          <ul>
            <li>Nos prestataires techniques (hébergement, paiement)</li>
            <li>Les autorités compétentes (obligation légale)</li>
            <li>Nos partenaires avec votre consentement explicite</li>
          </ul>

          <h3>Conservation des données</h3>
          <p>
            Nous conservons vos données uniquement le temps nécessaire :
          </p>
          <ul>
            <li>Données de compte : Pendant la durée du contrat + 3 ans</li>
            <li>Données d'appels : 2 ans maximum</li>
            <li>Données de facturation : 10 ans (obligation légale)</li>
            <li>Cookies : 13 mois maximum</li>
          </ul>

          <h3>Transferts internationaux</h3>
          <p>
            Vos données sont principalement stockées en France. En cas de transfert vers un pays tiers, nous nous assurons que des garanties appropriées sont en place.
          </p>

          <h3>Contact</h3>
          <p>
            Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits :
          </p>
          <ul>
            <li><strong>Email</strong> : contact.smartcrm@gmail.com</li>
            <li><strong>Téléphone</strong> : +33 7 49 34 55 10</li>
            <li><strong>Adresse</strong> : mySmartFood, Knutange, France</li>
          </ul>
          <p>
            Vous pouvez également contacter la CNIL (Commission Nationale de l'Informatique et des Libertés) si vous estimez que vos droits ne sont pas respectés.
          </p>

          <h3>Modifications</h3>
          <p>
            Cette politique de confidentialité peut être mise à jour. Nous vous informerons de tout changement significatif par email ou via notre site web.
          </p>
          <p>
            <strong>Dernière mise à jour</strong> : Aout 2025
          </p>
        </div>
      </Section>
    </PageContainer>
  );
};

export default PolitiqueConfidentialite; 