import type { Adresse, DeliveryQuote, RelayPoint } from "@/lib/types";
import { attendre, erreurSimulee, MockError } from "./storage";

export async function getDeliveryQuote(nbMarchands: number): Promise<DeliveryQuote> {
  await attendre(400);
  // Un envoi par marchand : les frais s'additionnent.
  return {
    domicile: { prix: Number((4.95 * nbMarchands).toFixed(2)), delai: "2 à 4 jours ouvrés" },
    relais: { prix: Number((2.95 * nbMarchands).toFixed(2)), delai: "3 à 5 jours ouvrés" },
  };
}

const NOMS = [
  "Tabac de la Mairie",
  "Relais Colis — Pressing Éclair",
  "Librairie du Marché",
  "Carrefour City",
  "Fleuriste Les Lilas",
  "Cordonnerie Saint-Paul",
];

/** Points relais autour d'une adresse (le plus proche en premier). */
export async function findRelayPoints(
  adresse: Pick<Adresse, "codePostal" | "ville"> & { numeroEtRue?: string },
): Promise<RelayPoint[]> {
  await attendre(700);
  if (erreurSimulee()) throw new MockError("Impossible de charger les points relais.");
  const graine = Number(adresse.codePostal.slice(-2)) || 7;
  return NOMS.map((nom, i) => ({
    id: `relais_${adresse.codePostal}_${i}`,
    nom,
    adresse: `${((graine * (i + 3)) % 140) + 1} ${["rue de la République", "avenue Jean-Jaurès", "rue Victor-Hugo", "boulevard Voltaire", "rue des Écoles", "place du Marché"][i]}, ${adresse.codePostal} ${adresse.ville}`,
    distanceKm: Number((0.3 + i * 0.45 + (graine % 5) * 0.05).toFixed(1)),
    horaires: i % 2 === 0 ? "Lun–Sam 9h–19h" : "Mar–Sam 10h–19h30",
  })).sort((a, b) => a.distanceKm - b.distanceKm);
}
