import React from "react";

// Composants
import {
  PageContainer,
  Hero,
  Section,
  SectionHeader,
  FeaturesGrid,
  ContactInfoCard,
  ContactForm,
  ContactBenefits,
  MapSection,
} from "../components";

// Hooks
import { useContactData } from "../hooks/useContactData";

const Contact = () => {
  const { contactInfo, departments } = useContactData();

  return (
    <PageContainer>
      <Hero
        title="Contactez "
        gradientText="mySmartFood"
        description="Notre équipe est là pour vous accompagner. N'hésitez pas à nous contacter pour toute question ou demande de démonstration."
      />

      <Section variant="alt">
        <div className="contact-info-grid">
          {contactInfo.map((info, index) => (
            <ContactInfoCard
              key={index}
              icon={info.icon}
              title={info.title}
              value={info.value}
              description={info.description}
              delay={index * 0.1}
            />
          ))}
        </div>
      </Section>

      {/* <Section>
        <SectionHeader
          title="Nos "
          gradientText="Départements"
          description="Contactez le bon département selon votre besoin."
        />
        <FeaturesGrid features={departments} columns={4} />
      </Section> */}

      <Section variant="alt">
        <div className="contact-form-grid">
          <div className="contact-info">
            <h2 className="contact-title">
              Envoyez-nous un <span className="text-gradient">message</span>
            </h2>
            <p className="contact-info-text">
              Remplissez le formulaire ci-contre et notre équipe vous répondra
              dans les plus brefs délais. Nous sommes là pour vous accompagner
              dans votre projet.
            </p>
            <ContactBenefits />
          </div>
          <ContactForm />
        </div>
      </Section>

      {/* <Section>
        <MapSection />
      </Section> */}
    </PageContainer>
  );
};

export default Contact;
