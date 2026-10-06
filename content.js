// Scans visible page text for CPU model names and tags them with their
// PassMark cpu-list/all rank. Runs only on sites the user enabled via the popup.

(function () {
  const STORAGE_KEY = 'cpuRankEnabledSites';
  const BADGE_CLASS = 'cpu-rank-ext-badge';
  const STOPWORDS = new Set(['intel', 'amd', 'apple', 'core', 'processor', 'cpu']);
  const MAX_WINDOW = 4;
  // Marketing filler that sits between the real model tokens on e-commerce listings,
  // e.g. "Core i5 13th Gen 13420H" or "Core 5 Series 3 315" -- stripped so the
  // remaining tokens ("i5","13420H" / "5","315") sit adjacent for window matching.
  const ORDINAL_RE = /^\d{1,2}(st|nd|rd|th)$/;
  const GEN_RE = /^gen(eration)?$/;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT']);

  let cpuIndex = null; // Map<normalizedKey, {name, mark, rank}>
  let scanned = false;

  function normalize(str) {
    const cleaned = str.replace(/@\s*[\d.]+\s*ghz/gi, '');
    const tokens = cleaned
      .split(/\s+/)
      .map((t) => t.toLowerCase())
      .filter((t) => t && !STOPWORDS.has(t))
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter(Boolean);
    return tokens.join('');
  }

  function buildIndex() {
    const map = new Map();
    // ponytail: first match wins on duplicate normalized keys (rare), good enough.
    for (const [name, mark, rank] of self.CPU_DATA) {
      // Skip names with non-ASCII characters (e.g. "天玑900"): normalize() strips
      // them entirely, which can collapse a name down to a bare number like "900"
      // that then matches any price/spec digit on the page.
      if (/[^\x00-\x7F]/.test(name)) continue;
      const key = normalize(name);
      if (key && !map.has(key)) map.set(key, { name, mark, rank });
    }
    return map;
  }

  function tokenizeWithPositions(text) {
    const tokens = [];
    const re = /[A-Za-z0-9][A-Za-z0-9-]*/g;
    let m;
    while ((m = re.exec(text))) {
      tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    }
    return tokens;
  }

  // Drops "Series N" pairs and "13th"/"Gen" filler so the significant tokens used
  // for window matching sit next to each other even when a listing title inserts
  // generation marketing between the brand tier and the model number.
  function significantTokens(tokens) {
    const sig = [];
    let afterSeries = false;
    for (const t of tokens) {
      const low = t.text.toLowerCase();
      if (afterSeries && /^\d{1,2}$/.test(low)) {
        afterSeries = false;
        continue;
      }
      afterSeries = low === 'series';
      if (low === 'series' || GEN_RE.test(low) || ORDINAL_RE.test(low)) continue;
      sig.push(t);
    }
    return sig;
  }

  function makeBadge(match) {
    const span = document.createElement('span');
    span.className = BADGE_CLASS;
    span.style.color = '#d00000';
    span.style.fontWeight = 'bold';
    span.textContent = ` (${match.name}, PassMark rank #${match.rank}) `;
    return span;
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.trim().length < 2) return;

    const rawTokens = tokenizeWithPositions(text);
    if (!rawTokens.length) return;
    const tokens = significantTokens(rawTokens);
    if (!tokens.length) return;

    const frag = document.createDocumentFragment();
    let cursor = 0;
    let i = 0;
    let found = false;

    while (i < tokens.length) {
      let matched = null;
      let matchLen = 0;
      const maxLen = Math.min(MAX_WINDOW, tokens.length - i);
      for (let len = maxLen; len >= 1; len--) {
        const windowTokens = tokens.slice(i, i + len);
        const key = windowTokens.map((t) => normalize(t.text)).join('');
        if (key && cpuIndex.has(key)) {
          matched = cpuIndex.get(key);
          matchLen = len;
          break;
        }
      }

      if (matched) {
        const windowEnd = tokens[i + matchLen - 1].end;
        frag.appendChild(document.createTextNode(text.slice(cursor, windowEnd)));
        frag.appendChild(makeBadge(matched));
        cursor = windowEnd;
        i += matchLen;
        found = true;
      } else {
        i += 1;
      }
    }

    if (!found) return;
    frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }

  function scanPage() {
    if (!cpuIndex) cpuIndex = buildIndex();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const parent = n.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`.${BADGE_CLASS}`)) return NodeFilter.FILTER_REJECT;
        if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(processTextNode);
    scanned = true;
  }

  function unscanPage() {
    document.querySelectorAll(`.${BADGE_CLASS}`).forEach((el) => el.remove());
    scanned = false;
  }

  function isEnabledForHost(host, cb) {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      const sites = res[STORAGE_KEY] || {};
      cb(!!sites[host]);
    });
  }

  isEnabledForHost(location.hostname, (enabled) => {
    if (enabled) scanPage();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'enable') {
      if (!scanned) scanPage();
      sendResponse({ ok: true });
    } else if (msg.action === 'disable') {
      unscanPage();
      sendResponse({ ok: true });
    }
    return true;
  });
})();
