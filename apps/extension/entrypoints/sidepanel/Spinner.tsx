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

/** Chargement épuré : « Recherche en cours » suivi de trois points qui rebondissent. */
export function LoadingDots({ text = "Recherche en cours" }: { text?: string }) {
  return (
    <p className="loading-dots" role="status">
      {text}
      <span className="dots" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </p>
  );
}
