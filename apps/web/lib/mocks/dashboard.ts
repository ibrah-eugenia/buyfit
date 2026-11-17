import type { DashboardData, FoundProduct, LookCapture, TryOnEntry, WebProfile } from "@/lib/types";
import { CATALOGUE } from "./catalog";
import { getOrders, seedOrders } from "./orders";
import { tailleConseillee } from "./search";
import { attendre, erreurSimulee, MockError } from "./storage";

const ilYa = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

/** Looks capturés par l'extension (fictifs tant que la table n'existe pas côté Supabase). */
const LOOKS: LookCapture[] = [
  {
    id: "look_1",
    imageUrl: "https://example.com/buyfit/pin-costume.jpg",
    pinUrl: "https://www.pinterest.fr/pin/1/",
    capturedAt: ilYa(2),
    description: "Costume noir casual",
    statut: "produits_trouves",
  },
  {
    id: "look_2",
    imageUrl: "https://example.com/buyfit/pin-pull.jpg",
    pinUrl: "https://www.pinterest.fr/pin/2/",
    capturedAt: ilYa(26),
    description: "Pull col roulé torsadé en laine",
    statut: "produits_trouves",
  },
  {
    id: "look_3",
    imageUrl: "https://example.com/buyfit/pin-robe.jpg",
    pinUrl: "https://www.pinterest.fr/pin/3/",
    capturedAt: ilYa(50),
    description: "Robe satin vert sauge",
    statut: "aucun_resultat",
  },
  {
    id: "look_4",
    imageUrl: "https://example.com/buyfit/pin-trench.jpg",
    pinUrl: "https://www.pinterest.fr/pin/4/",
    capturedAt: ilYa(0.05),
    description: "Trench beige ceinturé",
    statut: "analyse",
  },
];

const PRODUITS_PAR_LOOK: Record<string, string[]> = {
  look_1: ["zara-blazer-noir", "hm-pantalon-pinces", "zara-derbies"],
  look_2: ["uniqlo-pull-col-roule", "cos-pull-torsade", "rl-pull-cable"],
};

export async function getDashboard(
  userId: string,
  profil: WebProfile | null,
): Promise<DashboardData> {
  await attendre(700);
  if (erreurSimulee()) throw new MockError("Le tableau de bord n'a pas pu être chargé.");
  seedOrders(userId);

  const produits: FoundProduct[] = Object.entries(PRODUITS_PAR_LOOK).flatMap(([captureId, ids]) =>
    ids.flatMap((pid, i) => {
      const p = CATALOGUE.find((c) => c.id === pid);
      if (!p) return [];
      const { motsCles: _m, ...produit } = p;
      return [
        {
          ...produit,
          captureId,
          score: [0.94, 0.87, 0.81][i] ?? 0.8,
          tailleConseillee: tailleConseillee(p, profil),
        },
      ];
    }),
  );

  const essayages: TryOnEntry[] = [
    {
      id: "try_1",
      productId: "zara-blazer-noir",
      produit: "Blazer noir coupe droite",
      marque: "Zara",
      statut: "pret",
      resultImageUrl: "https://example.com/buyfit/essayage-1.jpg",
      latencyMs: 2300,
      createdAt: ilYa(1.8),
    },
    {
      id: "try_2",
      productId: "cos-pull-torsade",
      produit: "Pull torsadé en laine",
      marque: "COS",
      statut: "pret",
      resultImageUrl: "https://example.com/buyfit/essayage-2.jpg",
      latencyMs: 2800,
      createdAt: ilYa(25),
    },
    {
      id: "try_3",
      productId: "hm-pantalon-pinces",
      produit: "Pantalon noir à pinces",
      marque: "H&M",
      statut: "en_cours",
      createdAt: ilYa(0.02),
    },
    {
      id: "try_4",
      productId: "rl-pull-cable",
      produit: "Pull torsadé en coton",
      marque: "Ralph Lauren",
      statut: "echec",
      createdAt: ilYa(24),
    },
  ];

  return { looks: LOOKS, produits, essayages, commandes: await getOrders(userId) };
}
