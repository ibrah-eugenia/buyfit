import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "wxt";

// Un seul .env à la racine du monorepo. Seules API_URL et WXT_USE_MOCK_API sont
// injectées dans le bundle : AUCUNE clé d'API ne doit finir dans l'extension.
const rootEnv = resolve(import.meta.dirname, "../../.env");
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const apiUrl = process.env.API_URL || "http://localhost:8787";
const webUrl = new URL(process.env.WEB_URL || "http://localhost:3000").origin;
const useMock = process.env.WXT_USE_MOCK_API === "true";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "BuyFit",
    description: "Trouve ce look Pinterest dans ton budget, essaie-le et commande-le.",
    permissions: ["contextMenus", "sidePanel", "storage"],
    host_permissions: ["*://*.pinterest.com/*", `${new URL(apiUrl).origin}/*`, `${webUrl}/*`],
    action: { default_title: "Ouvrir BuyFit" },
  },
  vite: () => ({
    define: {
      "import.meta.env.WXT_WEB_URL": JSON.stringify(webUrl),
      "import.meta.env.WXT_API_URL": JSON.stringify(apiUrl),
      "import.meta.env.WXT_USE_MOCK_API": JSON.stringify(useMock),
    },
  }),
});
