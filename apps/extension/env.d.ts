interface ImportMetaEnv {
  /** URL de apps/api (variable API_URL du .env racine). */
  readonly WXT_API_URL: string;
  /** true → l'extension simule l'API (dev sans back-end). */
  readonly WXT_USE_MOCK_API: boolean;
  /** false → pas de recherche Bright Data : l'extension s'arrête aux mots-clés (à copier). */
  readonly WXT_ENABLE_SEARCH: boolean;
  /** Lien optionnel vers la console SERP Bright Data, affiché à côté des mots-clés. */
  readonly WXT_SERP_CONSOLE_URL: string;
}
