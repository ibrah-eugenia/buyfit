import { browser } from "wxt/browser";

/**
 * Onglet que l'utilisateur regarde. En side panel ou popup d'action, c'est l'onglet actif de la
 * fenêtre courante ; en fenêtre BuyFit séparée (?mode=window), la fenêtre courante est la nôtre :
 * on prend alors l'onglet actif de la dernière fenêtre de navigation.
 */
export async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && !tab.url.startsWith(browser.runtime.getURL("/"))) return tab;
  try {
    const win = await browser.windows.getLastFocused({ windowTypes: ["normal"] });
    const [t] = await browser.tabs.query({ active: true, windowId: win.id });
    return t;
  } catch {
    return tab;
  }
}
