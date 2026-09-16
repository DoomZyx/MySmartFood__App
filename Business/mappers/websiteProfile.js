export function profileToWebsite(profile, amenities = []) {
  if (!profile) return {};
  const pmr = amenities.find((item) => item.slug === "pmr");
  const highchair = amenities.find((item) => item.slug === "highchair");
  return {
    nomEtablissement: profile.businessName,
    adresse: profile.addressLine,
    codePostal: profile.postalCode,
    ville: profile.city,
    pays: profile.country,
    telephone: profile.phone,
    email: profile.email,
    nombreCouverts: profile.seatCount,
    typeCuisine: profile.cuisineType,
    twilioNumberUsage: profile.phoneNumberUsage,
    accessibilitePmr:
      pmr?.status === "available" ? true : pmr?.status === "unavailable" ? false : null,
    nombreChaisesBebe:
      highchair?.status === "unknown" ? null : highchair?.quantity ?? null,
  };
}
