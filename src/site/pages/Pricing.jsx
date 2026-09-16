import React from "react";

// Composants
import {
  PageContainer,
  Hero,
  Section,
  SectionHeader,
  PricingGrid,
  FeaturesGrid,
  FAQGrid,
  CTASection,
} from "../components";

// Hooks
import { usePricingData } from "../hooks/usePricingData";

const Pricing = () => {
  const { visiblePlans, addons, faqs } = usePricingData();

  return (
    <PageContainer>
      <Hero
        title="Un abonnement pour "
        gradientText="rendre la salle au service"
        description="Pendant la beta, une seule offre : 150 €/mois, 1300 minutes, 10 appels simultanés, support prioritaire pour vos retours."
      />

      <Section variant="alt">
        <PricingGrid plans={visiblePlans} />
      </Section>

      {addons.length > 0 && (
        <Section>
          <SectionHeader
            title="Modules "
            gradientText="Complémentaires"
            description="Personnalisez votre expérience avec nos modules additionnels."
          />
          <FeaturesGrid features={addons} columns={4} />
        </Section>
      )}

      <Section variant="alt">
        <SectionHeader
          title="Questions "
          gradientText="fréquentes"
          description="Tout ce que vous devez savoir sur les abonnements et les minutes incluses."
        />
        <FAQGrid faqs={faqs} />
      </Section>

      <CTASection
        title="Moins de stress, "
        gradientText="plus de clients servis"
        description="Demandez une démonstration. On vous montre la ligne, la salle, et ce qui arrive dans l'application. Offre beta à 150 €/mois."
        primaryButton="Demander une démonstration"
        secondaryButton="Parler à un expert"
      />
    </PageContainer>
  );
};

export default Pricing;
