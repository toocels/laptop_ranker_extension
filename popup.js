const STORAGE_KEY = 'cpuRankEnabledSites';

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

(async function init() {
  const tab = await getActiveTab();
  const toggle = document.getElementById('toggle');
  const hostEl = document.getElementById('host');

  if (!tab || !tab.url || !/^https?:/.test(tab.url)) {
    hostEl.textContent = 'this page';
    toggle.disabled = true;
    return;
  }

  const host = new URL(tab.url).hostname;
  hostEl.textContent = host;

  const { [STORAGE_KEY]: sites = {} } = await chrome.storage.local.get([STORAGE_KEY]);
  toggle.checked = !!sites[host];

  toggle.addEventListener('change', async () => {
    const { [STORAGE_KEY]: current = {} } = await chrome.storage.local.get([STORAGE_KEY]);
    if (toggle.checked) {
      current[host] = true;
    } else {
      delete current[host];
    }
    await chrome.storage.local.set({ [STORAGE_KEY]: current });
    chrome.tabs.sendMessage(tab.id, { action: toggle.checked ? 'enable' : 'disable' }).catch(() => {});
  });
})();
