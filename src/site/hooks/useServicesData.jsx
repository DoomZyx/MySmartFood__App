import React from "react";
import {
  Phone,
  BarChart3,
  UtensilsCrossed,
  Shield,
  Smartphone,
  ClipboardList,
  Bot,
  Clock,
  TrendingUp,
  Heart,
} from "lucide-react";

export const useServicesData = () => {
  const crmFeatures = [
    {
      icon: <UtensilsCrossed className="icon" />,
      title: "Carte à votre image",
      description:
        "Plats, compositions, suppléments. L'assistant s'appuie sur votre carte pour répondre juste, sans interrompre la salle.",
    },
    {
      icon: <ClipboardList className="icon" />,
      title: "Commandes et réservations",
      description:
        "Tout arrive dans l'application. L'équipe valide et enchaîne, au lieu de jongler avec le téléphone.",
    },
    {
      icon: <BarChart3 className="icon" />,
      title: "CA des appels rattrapés",
      description:
        "Chaque appel pris est une commande ou une table possible. Vous voyez ce que l'assistant a écrit pendant que vous serviez.",
    },
  ];

  const aiFeatures = [
    {
      icon: <Phone className="icon" />,
      title: "La ligne ne sonne plus dans la salle",
      description:
        "L'assistant décroche 24/7. En coup de feu, personne n'abandonne une table pour le standard.",
    },
    {
      icon: <Bot className="icon" />,
      title: "Entraîné restauration",
      description:
        "Horaires, capacité, emporter, imprévus. Pas un standard générique : il parle comme votre établissement.",
    },
    {
      icon: <Heart className="icon" />,
      title: "Imprévus du quotidien",
      description:
        "Chaise haute, PMR, allergie. L'assistant les note. L'équipe les traite quand elle a les mains libres.",
    },
    {
      icon: <Shield className="icon" />,
      title: "Sérénité de l'équipe",
      description:
        "Moins de pression sur le personnel, plus d'attention aux clients présents. C'est ça que l'on vend.",
    },
  ];

  const integrations = [
    {
      icon: <Smartphone className="icon" />,
      title: "Une appli pour piloter, pas pour courir",
      description:
        "Carte, commandes, réservations. Vous voyez ce qui rentre. La salle reste le centre de gravité.",
    },
    {
      icon: <Clock className="icon" />,
      title: "Beta à 150 €/mois",
      description:
        "1300 minutes, 10 appels simultanés, support prioritaire pour vos retours et les ajustements.",
    },
    {
      icon: <TrendingUp className="icon" />,
      title: "Fait pour un restaurant, pas pour un call center",
      description:
        "Les outils génériques gèrent une voix. Nous gérons le service : salle, téléphone, ticket.",
    },
  ];

  return {
    crmFeatures,
    aiFeatures,
    integrations,
  };
};
