import { profileToWebsite } from "./websiteProfile.js";

describe("profileToWebsite", () => {
  test("mappe le profil et les equipements", () => {
    const dto = profileToWebsite(
      {
        businessName: "Chez Test",
        addressLine: "1 rue A",
        postalCode: "75001",
        city: "Paris",
        country: "France",
        phone: "0102030405",
        email: "a@b.fr",
        seatCount: 40,
        cuisineType: "Francaise",
        phoneNumberUsage: "reservations",
      },
      [
        { slug: "pmr", status: "available" },
        { slug: "highchair", status: "available", quantity: 3 },
      ]
    );
    expect(dto.nomEtablissement).toBe("Chez Test");
    expect(dto.accessibilitePmr).toBe(true);
    expect(dto.nombreChaisesBebe).toBe(3);
  });

  test("laisse PMR et chaises non renseignes si unknown", () => {
    const dto = profileToWebsite(
      { businessName: "Chez Test" },
      [
        { slug: "pmr", status: "unknown" },
        { slug: "highchair", status: "unknown" },
      ]
    );
    expect(dto.accessibilitePmr).toBeNull();
    expect(dto.nombreChaisesBebe).toBeNull();
  });
});
