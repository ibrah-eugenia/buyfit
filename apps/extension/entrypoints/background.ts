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

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    browser.contextMenus.create({
      id: MENU_ID,
      title: "Trouver ce look avec BuyFit",
      contexts: ["image"],
    });
  });

  // Clic sur l'icône → ouvre le side panel.
  void browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  browser.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId !== MENU_ID || !info.srcUrl || tab?.id === undefined) return;
    // sidePanel.open doit être appelé tout de suite (dans le geste utilisateur), avant tout await.
    void browser.sidePanel.open({ tabId: tab.id });
    void capture(tab.id, info.srcUrl, info.pageUrl ?? tab.url ?? info.srcUrl);
  });
});

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
