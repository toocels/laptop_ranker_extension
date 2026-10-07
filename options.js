const STORAGE_KEY = 'cpuRankEnabledSites';

async function render() {
  const { [STORAGE_KEY]: sites = {} } = await chrome.storage.local.get([STORAGE_KEY]);
  const hosts = Object.keys(sites).sort();

  const list = document.getElementById('list');
  const empty = document.getElementById('empty');
  list.innerHTML = '';
  empty.hidden = hosts.length > 0;

  for (const host of hosts) {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = host;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.addEventListener('click', () => removeHost(host));
    li.append(span, btn);
    list.appendChild(li);
  }
}

async function removeHost(host) {
  const { [STORAGE_KEY]: sites = {} } = await chrome.storage.local.get([STORAGE_KEY]);
  delete sites[host];
  await chrome.storage.local.set({ [STORAGE_KEY]: sites });

  // Turn off any live tabs on that site too, so the badge disappears without a reload.
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (!tab.url) continue;
    try {
      if (new URL(tab.url).hostname !== host) continue;
    } catch {
      continue;
    }
    chrome.tabs.sendMessage(tab.id, { action: 'disable' }).catch(() => {});
    chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  }

  render();
}

render();
