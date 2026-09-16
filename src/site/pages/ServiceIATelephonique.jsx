import React from "react";
import { PageContainer, Hero, Section, SectionHeader, CTASection } from "../components";

const ServiceIATelephonique = () => {
  return (
    <PageContainer className="service-page">
      <Hero
        title="La salle d'abord. "
        gradientText="Le téléphone, c'est l'assistant."
        description="Pendant le service, l'équipe reste aux tables. L'assistant prend commandes et réservations, les écrit dans l'application. Moins de stress, plus de clients satisfaits."
      />

      <Section>
        <SectionHeader
          title="Prioriser la salle"
          description="Décrocher n'est plus le travail du coup de feu"
        />
        <div className="legal-content">
          <h3>L'équipe sert, l'assistant répond</h3>
          <p>En service ou hors horaires, la ligne est tenue. Personne n'abandonne une table pour le standard. Les commandes et réservations arrivent déjà posées dans l'application.</p>

          <h3>Fait pour un restaurant</h3>
          <ul>
            <li>Carte, horaires, capacité, emporter</li>
            <li>Imprévus du quotidien (chaise haute, PMR)</li>
            <li>Pas un outil générique de call center</li>
          </ul>
        </div>
      </Section>

      <Section variant="alt">
        <SectionHeader
          title="Commandes et réservations"
          description="L'application centralise ce que l'assistant a pris"
        />
        <div className="legal-content">
          <h3>Une carte que l'assistant connaît</h3>
          <p>Plats, compositions, suppléments. Le client au téléphone a une réponse précise. L'équipe en salle n'est pas interrompue pour répéter le menu.</p>

          <h3>Tout est écrit, vous pilotez</h3>
          <ul>
            <li>Réservations et commandes dans l'interface</li>
            <li>L'équipe valide et enchaîne, sans courir</li>
            <li>Moins de charge mentale pour le personnel</li>
          </ul>
        </div>
      </Section>

      <Section>
        <SectionHeader
          title="CA rattrapé, équipe plus posée"
          description="Le gain se voit sur les appels et dans la salle"
        />
        <div className="legal-content">
          <h3>Ce que vous récupérez</h3>
          <p>Chaque appel pris est une commande ou une table possible. Le tableau de bord montre ce que l'assistant a enregistré pendant que vous serviez.</p>

          <h3>Abonnement avec minutes incluses</h3>
          <ul>
            <li>Volume d'appels selon la formule</li>
            <li>Offre beta à 150 €/mois, en conditions réelles de service</li>
            <li>Paliers si le volume monte</li>
          </ul>
        </div>
      </Section>

      <CTASection
        title="Rendre la salle "
        gradientText="au personnel"
        description="Demandez une démonstration. On vous montre la ligne, ce qui arrive dans l'application, et ce que ça change en service."
        primaryButton="Demander une démonstration"
        secondaryButton="Parler à un expert"
      />
    </PageContainer>
  );
};

export default ServiceIATelephonique;
