// A full tab keeps the upload and result visible throughout the generation.
chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('tester.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['TAB'],
    documentUrls: [url],
  });
  const existing = contexts.find((context) => context.tabId >= 0);
  if (existing) {
    try {
      await chrome.tabs.update(existing.tabId, { active: true });
      await chrome.windows.update(existing.windowId, { focused: true });
      return;
    } catch {
      // The user may have closed the tab between discovery and activation.
    }
  }
  await chrome.tabs.create({ url });
});
