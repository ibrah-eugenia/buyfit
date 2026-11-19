interface ImportMetaEnv {
  readonly WXT_WEB_URL: string;
  /** URL de apps/api (variable API_URL du .env racine). */
  readonly WXT_API_URL: string;
  /** true → l'extension simule l'API (dev sans back-end). */
  readonly WXT_USE_MOCK_API: boolean;
}
