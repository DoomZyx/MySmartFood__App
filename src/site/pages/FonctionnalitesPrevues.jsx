import React from "react";
import { PageContainer, Hero, Section, SectionHeader, CTASection } from "../components";

const FonctionnalitesPrevues = () => {
  return (
    <PageContainer className="service-page">
      <Hero
        title="Fonctionnalités "
        gradientText="Prévues"
        description="Découvrez les évolutions prévues pour la version 2 de l'assistant vocal dédié aux restaurateurs."
      />

      <Section>
        <SectionHeader
          title="Prévu pour la V2"
          description="Fonctionnalités planifiées pour la prochaine version"
        />
        <div className="legal-content">
          <h3>Analytics</h3>
          <p>
            Tableaux de bord et statistiques détaillées pour suivre l'activité des appels,
            les tendances et les performances de l'assistant vocal.
          </p>

          <h3>Livraison</h3>
          <p>
            Prise en charge des commandes en livraison : gestion des adresses, créneaux
            et suivi des commandes à livrer.
          </p>

          <h3>Calcul du chiffre d'affaires</h3>
          <p>
            Calcul et suivi du CA généré par l'assistant vocal (commandes et réservations
            prises via l'IA) pour mesurer l'impact sur votre activité.
          </p>
        </div>
      </Section>

      <CTASection
        title="Participez à l'évolution de "
        gradientText="mySmartFood"
        description="Votre feedback est précieux. Partagez vos suggestions pour les prochaines versions."
        primaryButton="Demander une démonstration"
        secondaryButton="Parler à un expert"
      />
    </PageContainer>
  );
};

export default FonctionnalitesPrevues;
