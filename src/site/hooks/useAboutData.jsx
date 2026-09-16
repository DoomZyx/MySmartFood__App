export const useAboutData = () => {
  const storyData = {
    title: "Notre ",
    gradientText: "Histoire",
    paragraphs: [
      "mySmartFood est né d'une vision simple : démocratiser l'intelligence artificielle pour toutes les entreprises, quelle que soit leur taille. En 2025, le fondateur a constaté que les restaurateurs avaient un probleème récurrent la surcharge des appels.",
      "Il a donc décidé de créer une plateforme qui combine la puissance d'un outil de gestion avec l'intelligence artificielle, le tout dans une interface intuitive et accessible. L'objectif ? Permettre à chaque restaurateurs de bénéficier des mêmes outils que les grandes chaines.",
    ],
    stats: [
      { number: "0%", label: "D'appels manqués" },
      { number: "24h", label: "Temps de réponse" },
      { number: "99.9%", label: "Disponibilité" },
      { number: "24/7", label: "Support client" },
    ],
  };

  const teamMembers = [
    {
      name: "Axel Cella",
      role: "Fondateur",
      description:
        "Entrepreneur passionné de tech issu d'une famille d'experts dans le commerce, Axel combine une vision business avec des solutions technologiques modernes. Son expertise du terrain lui permet de créer des application web et des agents vocaux parfaitement adaptés aux besoins réels des professionnels",
    },
  ];

  const missionData = {
    title: "Notre ",
    gradientText: "Mission",
    description:
      "Nous croyons que chaque entreprise mérite d'avoir accès aux meilleures technologies pour développer sa relation client. Notre mission est de rendre l'IA accessible, simple et efficace pour tous.",
    buttonText: "Rejoindre l'aventure",
  };

  return {
    storyData,
    teamMembers,
    missionData,
  };
};


