export function profileToWebsite(profile) {
  if (!profile) return {};
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
  };
}
