import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "wxt";

// Un seul .env à la racine du monorepo. Seules API_URL et les flags WXT_* sont
// injectées dans le bundle : AUCUNE clé d'API ne doit finir dans l'extension.
const rootEnv = resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiUrl = process.env.API_URL || "http://localhost:8787";
const useMock = process.env.WXT_USE_MOCK_API === "true";
// Recherche Bright Data automatique : désactivée tant que WXT_ENABLE_SEARCH n'est pas "true".
const enableSearch = process.env.WXT_ENABLE_SEARCH === "true";
const serpConsoleUrl = process.env.WXT_SERP_CONSOLE_URL ?? "";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BuyFit",
    description: "Trouve ce look Pinterest dans ton budget, essaie-le et commande-le.",
    permissions: ["contextMenus", "notifications", "scripting", "sidePanel", "storage"],
    // Hôtes Pinterest : donnent aussi accès à l'URL de l'onglet ouvert (pré-remplissage du lien).
    host_permissions: [
      "*://*.pinterest.com/*",
      "*://*.pinterest.fr/*",
      "*://pin.it/*",
      "*://i.pinimg.com/*",
      `${new URL(apiUrl).origin}/*`,
    ],
    action: { default_title: "Ouvrir BuyFit" },
    // Le lanceur flottant affiche sidepanel.html dans une iframe sur Pinterest.
    web_accessible_resources: [
      {
        resources: ["sidepanel.html"],
        matches: ["*://*.pinterest.com/*", "*://*.pinterest.fr/*"],
      },
    ],
  },
  vite: () => ({
    define: {
      "import.meta.env.WXT_API_URL": JSON.stringify(apiUrl),
      "import.meta.env.WXT_USE_MOCK_API": JSON.stringify(useMock),
      "import.meta.env.WXT_ENABLE_SEARCH": JSON.stringify(enableSearch),
      "import.meta.env.WXT_SERP_CONSOLE_URL": JSON.stringify(serpConsoleUrl),
    },
  }),
});
