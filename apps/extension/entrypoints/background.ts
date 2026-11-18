import type { InspirationCapture } from "@buyfit/shared";
import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
  CAPTURE_STORAGE_KEY,
  type ResolveImageMessage,
  type ResolveImageResponse,
} from "@/lib/messages";
import { upgradePinimgUrl } from "@/lib/pinimg";

const MENU_ID = "buyfit-find-look";
/** Même page que le side panel, en popup sous l'icône (navigateurs sans side panel, ex. Comet). */
const POPUP_PAGE = "sidepanel.html?mode=popup";

/**
 * Side panel dispo ? Certains navigateurs Chromium (Comet…) n'exposent pas chrome.sidePanel :
 * on bascule alors sur une popup d'action.
 */
const hasSidePanel = () =>
  typeof browser.sidePanel?.open === "function" &&
  typeof browser.sidePanel?.setPanelBehavior === "function";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Trouver ce look avec BuyFit",
      contexts: ["image"],
    });
  });

  void setupOpening();

  // Notifications d'achat (lib/purchase.ts) : id « buyfit-order|<tabId>|<ts> ».
  browser.notifications?.onClicked.addListener((id) => {
    if (!id.startsWith("buyfit-order|")) return;
    void browser.notifications.clear(id);
    const tabId = Number(id.split("|")[1]);
    if (!Number.isInteger(tabId)) return;
    void browser.tabs
      .update(tabId, { active: true })
      .then((tab) => {
        if (tab?.windowId !== undefined) void browser.windows.update(tab.windowId, { focused: true });
        return browser.tabs.sendMessage(tabId, { type: "buyfit:open-launcher" });
      })
      .catch(() => {});
  });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !info.srcUrl || tab?.id === undefined) return;
    // Sur Pinterest : le panneau du logo flottant s'ouvre sur la page.
    // Ailleurs : side panel (ouvert tout de suite, dans le geste utilisateur), sinon popup.
    if (/^https?:\/\/([\w-]+\.)*pinterest\.(com|fr)\//.test(tab.url ?? "")) {
      void browser.tabs.sendMessage(tab.id, { type: "buyfit:open-launcher" }).catch(() => {});
    } else if (hasSidePanel()) {
      browser.sidePanel.open({ tabId: tab.id }).catch(() => openFallback(tab.windowId));
    } else {
      openFallback(tab.windowId);
    }
    void capture(tab.id, info.srcUrl, info.pageUrl ?? tab.url ?? info.srcUrl);
  });
});

/** Clic sur l'icône : side panel si possible, sinon popup. */
async function setupOpening() {
  if (hasSidePanel()) {
    try {
      await browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      await browser.action.setPopup({ popup: "" });
      return;
    } catch (e) {
      console.warn("[buyfit] side panel indisponible, bascule en popup", e);
    }
  }
  await browser.action.setPopup({ popup: POPUP_PAGE });
}

/** Menu contextuel sans side panel : popup d'action, sinon petite fenêtre. */
function openFallback(windowId?: number) {
  browser.action.openPopup(windowId !== undefined ? { windowId } : undefined).catch(() =>
    browser.windows.create({
      url: browser.runtime.getURL("/sidepanel.html?mode=window"),
      type: "popup",
      width: 400,
      height: 680,
    }),
  );
}

async function capture(tabId: number, srcUrl: string, pageUrl: string) {
  let resolved: ResolveImageResponse;
  try {
    // Sur pinterest.com, le content script trouve l'image grand format et l'URL de l'épingle.
    const msg: ResolveImageMessage = { type: "buyfit:resolve-image", srcUrl };
    resolved = (await browser.tabs.sendMessage(tabId, msg)) as ResolveImageResponse;
  } catch {
    // Hors Pinterest (pas de content script) : on garde l'image cliquée.
    resolved = { imageUrl: upgradePinimgUrl(srcUrl), pinUrl: pageUrl };
  }
  const data: InspirationCapture = { ...resolved, capturedAt: new Date().toISOString() };
  await browser.storage.session.set({ [CAPTURE_STORAGE_KEY]: data });
}
