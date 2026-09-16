import React from "react";

// Composants
import {
  PageContainer,
  Hero,
  Section,
  SectionHeader,
  FeaturesGrid,
  CTASection,
} from "../components";

// Hooks
import { useServicesData } from "../hooks/useServicesData";

const Services = () => {
  const { crmFeatures, aiFeatures, integrations } = useServicesData();

  return (
    <PageContainer>
      <Hero
        title="La salle reste "
        gradientText="votre priorité"
        description="L'assistant tient le téléphone. L'application pose commandes et réservations. Votre équipe sert les clients présents, sans courir."
      />

      <Section variant="alt">
        <SectionHeader
          title="Ce que l'application "
          gradientText="prend en charge"
          description="La carte, les commandes et les réservations au même endroit. Vous pilotez le service, pas le standard."
        />
        <FeaturesGrid features={crmFeatures} columns={4} />
      </Section>

      <Section>
        <SectionHeader
          title="Ce que l'assistant "
          gradientText="enlève à l'équipe"
          description="Décrocher en coup de feu, répéter la carte, noter une résa. L'IA le fait. Le personnel reste en salle."
        />
        <FeaturesGrid features={aiFeatures} columns={4} variant="alt" />
      </Section>

      <Section variant="alt">
        <SectionHeader
          title="Pourquoi ça tient "
          gradientText="en restauration"
          description="Pas un outil générique : une ligne, une carte, un service. Moins de stress, plus de clients traités."
        />
        <FeaturesGrid features={integrations} columns={3} />
      </Section>

      <CTASection
        title="Rendre la salle "
        gradientText="au personnel"
        description="Demandez une démonstration. On vous montre le flux pendant un service. Offre beta à 150 €/mois."
        primaryButton="Demander une démonstration"
      />
    </PageContainer> 
  );
};

export default Services;
