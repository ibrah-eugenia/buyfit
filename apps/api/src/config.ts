import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true" || v === "1"));

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  /** Origines autorisées en CORS, séparées par des virgules (ex. chrome-extension://<id>). */
  CORS_ORIGINS: z.string().optional(),

  HAI_API_KEY: z.string().optional(),
  HAI_AGENT_ID: z.string().default("h/web-surfer-pro"),
  /** Vault H contenant les logins marchands du profil de démo (mock Supabase). */
  HAI_DEMO_VAULT_ID: z.string().optional(),

  BRIGHTDATA_API_TOKEN: z.string().optional(),
  BRIGHTDATA_SERP_ZONE: z.string().default("serp_api1"),
  /** Google Lens via Bright Data (recherche par image). Désactivé : renvoie no_local_parser (17/11/2026). */
  BRIGHTDATA_USE_LENS: bool,

  /** Token Hugging Face (Inference Providers) pour identifier la pièce sélectionnée. */
  HF_TOKEN: z.string().optional(),
  /** Modèle de vision servi par les Inference Providers HF (format OpenAI chat + image). */
  HF_VISION_MODEL: z.string().default("google/gemma-4-26B-A4B-it"),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  TRYON_SERVICE_URL: z.string().optional(),

  /** Force le mock d'une brique. Par défaut : mock si la clé / l'URL manque. */
  MOCK_ALL: bool,
  MOCK_BRIGHTDATA: bool,
  MOCK_HCOMPANY: bool,
  MOCK_TRYON: bool,
  MOCK_SUPABASE: bool,
  MOCK_VISION: bool,
});

// Les variables vides ("FOO=") sont traitées comme absentes.
const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
const env = EnvSchema.parse(rawEnv);

const mock = (flag: boolean | undefined, ...required: (string | undefined)[]) =>
  env.MOCK_ALL ?? flag ?? required.some((v) => !v);

export const config = {
  ...env,
  mocks: {
    brightdata: mock(env.MOCK_BRIGHTDATA, env.BRIGHTDATA_API_TOKEN),
    hcompany: mock(env.MOCK_HCOMPANY, env.HAI_API_KEY),
    tryon: mock(env.MOCK_TRYON, env.TRYON_SERVICE_URL),
    vision: mock(env.MOCK_VISION, env.HF_TOKEN),
    supabase: mock(env.MOCK_SUPABASE, env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  },
} as const;
