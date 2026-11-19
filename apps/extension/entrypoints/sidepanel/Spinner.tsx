/** Rond de chargement qui tourne (couleur du texte ; `light` sur fond bordeaux). */
export function Spinner({ light = false, large = false }: { light?: boolean; large?: boolean }) {
  return (
    <span
      className={`spinner${light ? " light" : ""}${large ? " large" : ""}`}
      role="status"
      aria-label="Chargement"
    />
  );
}
