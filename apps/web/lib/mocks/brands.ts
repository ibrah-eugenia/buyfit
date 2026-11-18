/** Marques connues pour l'autocomplétion (on peut aussi en ajouter une absente de la liste). */
export const MARQUES_SUGGEREES = ["Zara", "H&M", "Uniqlo", "COS", "Mango", "Ralph Lauren"] as const;

export const MARQUES = [
  "& Other Stories",
  "Arket",
  "ba&sh",
  "Bershka",
  "COS",
  "Des Petits Hauts",
  "Galeries Lafayette",
  "H&M",
  "Jules",
  "Kiabi",
  "Lacoste",
  "Levi's",
  "Maison Kitsuné",
  "Mango",
  "Massimo Dutti",
  "Monoprix",
  "Pull&Bear",
  "Ralph Lauren",
  "Sandro",
  "Sézane",
  "Stradivarius",
  "The Kooples",
  "Uniqlo",
  "Zadig & Voltaire",
  "Zara",
] as const;

/** Marchands sur lesquels l'agent sait commander. */
export const MARCHANDS = [
  { marchand: "Zara", domaine: "zara.com" },
  { marchand: "H&M", domaine: "hm.com" },
  { marchand: "Uniqlo", domaine: "uniqlo.com" },
  { marchand: "COS", domaine: "cos.com" },
  { marchand: "Mango", domaine: "mango.com" },
  { marchand: "Ralph Lauren", domaine: "ralphlauren.fr" },
] as const;
