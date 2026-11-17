/** Symbole BuyFit : un B traversé d'une barre, comme un dollar (cf. brand kit). */
export function Symbol({ color = "currentColor", stroke = 26 }: { color?: string; stroke?: number }) {
  return (
    <svg viewBox="15 -8 100 176" aria-hidden="true">
      <path
        d="M30 140 V20 H64 A30 30 0 0 1 64 80 H30 H70 A30 30 0 0 1 70 140 Z"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinejoin="round"
      />
      <line x1="62" y1="-6" x2="62" y2="166" stroke={color} strokeWidth={stroke / 2} />
    </svg>
  );
}

/** Logotype « buyfit » : le symbole remplace le b. */
export function Wordmark() {
  return (
    <span className="wordmark" role="img" aria-label="buyfit">
      <Symbol />
      uyfit
    </span>
  );
}
