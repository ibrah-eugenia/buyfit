/**
 * Photos de la landing, servies par Unsplash (licence Unsplash ; le hotlink est la méthode
 * recommandée par Unsplash). Aucune n'est stockée dans le repo.
 */
const unsplash = (id: string, w: number) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Mannequin en blazer noir (hero, « après » de l'essayage). */
export const PHOTO_LOOK = unsplash("1730308242954-304f615bb73a", 900);
/** Même silhouette en t-shirt blanc (« avant » de l'essayage). */
export const PHOTO_AVANT = unsplash("1611451444023-7fe9d86fe1d0", 700);
/** Babies en cuir à boucles, fond blanc (carte produit). */
export const PHOTO_PRODUIT = unsplash("1758542988948-b95a6c4aa68b", 400);
