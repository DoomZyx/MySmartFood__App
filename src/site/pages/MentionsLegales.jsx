import React from "react";
import { PageContainer, Hero, Section, SectionHeader } from "../components";

const MentionsLegales = () => {
  return (
    <PageContainer className="service-page">
      <Hero
        title="Mentions "
        gradientText="Légales"
        description="Informations légales et conditions d'utilisation de mySmartFood"
      />

      <Section>
        <div className="legal-content">
          <h3>Éditeur du site</h3>
          <p>
            <strong>mySmartFood</strong>
            <br />
            Adresse : 125 rue de la République, 57240 Knutange France
            <br />
            Email : contact.smartcrm@gmail.com
            <br />
            Téléphone : +33 7 49 34 55 10
            <br />
            SIRET : N/A
            <br />
            Directeur de publication : CELLA Axel
          </p>

          <h3>Hébergement</h3>
          <p>
            Ce site est hébergé par :<br />
            Vercel Inc
            <br />
            Adresse : 650 California St, San Francisco, CA 94108, États-Unis
            <br />
          </p>

          <h3>Propriété intellectuelle</h3>
          <p>
            L'ensemble de ce site relève de la législation française et
            internationale sur le droit d'auteur et la propriété intellectuelle.
            Tous les droits de reproduction sont réservés, y compris pour les
            documents téléchargeables et les représentations iconographiques et
            photographiques.
          </p>
          <p>
            La reproduction de tout ou partie de ce site sur un support
            électronique quel qu'il soit est formellement interdite sauf
            autorisation expresse du directeur de la publication.
          </p>

          <h3>Responsabilité</h3>
          <p>
            Les informations contenues sur ce site sont aussi précises que
            possible et le site est périodiquement remis à jour, mais peut
            toutefois contenir des inexactitudes, des omissions ou des lacunes.
          </p>
          <p>
            Si vous constatez une lacune, erreur ou ce qui parait être un
            dysfonctionnement, merci de bien vouloir le signaler par email à
            l'adresse contact@smartcrm.fr, en décrivant le problème de la
            manière la plus précise possible.
          </p>

          <h3>Liens hypertextes</h3>
          <p>
            Les liens hypertextes mis en place dans le cadre du présent site web
            en direction d'autres ressources présentes sur le réseau Internet ne
            sauraient engager la responsabilité de SmartCRM.
          </p>

          <h3>Cookies</h3>
          <p>
            Le site peut-être amené à vous demander l'acceptation des cookies
            pour des besoins de statistiques et d'affichage. Un cookie ne nous
            permet pas de vous identifier ; il sert uniquement à enregistrer des
            informations relatives à la navigation de votre ordinateur sur notre
            site.
          </p>

          <h3>Droit applicable</h3>
          <p>
            Tout litige en relation avec l'utilisation du site smartcrm.fr est
            soumis au droit français. En dehors des cas où la loi ne le permet
            pas, il est fait attribution exclusive de juridiction aux tribunaux
            compétents de Paris.
          </p>

          <h3>Contact</h3>
          <p>
            Pour toute question concernant ces mentions légales, vous pouvez
            nous contacter à :<br />
            <strong>Email</strong> : contact.smartcrm@gmail.com
            <br />
            <strong>Téléphone</strong> : +33 7 49 34 55 10
            <br />
            <strong>Adresse</strong> : mySmartFood, Knutange, France
          </p>

          <p>
            <strong>Dernière mise à jour</strong> : Aout 2025
          </p>
        </div>
      </Section>
    </PageContainer>
  );
};

export default MentionsLegales;
