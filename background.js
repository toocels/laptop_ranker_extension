// Clicking the toolbar icon toggles the CPU-rank scan on the active tab's site directly
// -- no popup, no extra button. Pin the icon so it's reachable without opening the
// extensions menu; pinning isn't required for the click to work, just for easy access.

const STORAGE_KEY = 'cpuRankEnabledSites';

async function setBadge(tabId, on) {
  await chrome.action.setBadgeText({ tabId, text: on ? 'ON' : '' });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: '#d00000' });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url || !/^https?:/.test(tab.url)) return;
  const host = new URL(tab.url).hostname;

  const { [STORAGE_KEY]: sites = {} } = await chrome.storage.local.get([STORAGE_KEY]);
  const nowEnabled = !sites[host];
  if (nowEnabled) sites[host] = true;
  else delete sites[host];
  await chrome.storage.local.set({ [STORAGE_KEY]: sites });

  try {
    await chrome.tabs.sendMessage(tab.id, { action: nowEnabled ? 'enable' : 'disable' });
  } catch {
    // Content script not injected yet (e.g. page loaded before the extension did).
    if (nowEnabled) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['data/cpu-data.js', 'content.js'] });
    }
  }

  await setBadge(tab.id, nowEnabled);
});

// Keep the badge in sync when the user switches tabs or a tab finishes loading.
async function refreshBadge(tabId, url) {
  if (!url || !/^https?:/.test(url)) return;
  const host = new URL(url).hostname;
  const { [STORAGE_KEY]: sites = {} } = await chrome.storage.local.get([STORAGE_KEY]);
  await setBadge(tabId, !!sites[host]);
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  refreshBadge(tabId, tab.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') refreshBadge(tabId, tab.url);
});
