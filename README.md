# CPU Rank Finder (PassMark)

Chrome extension (Manifest V3) that scans a webpage for CPU model names (e.g.
"Intel i5 1235U", "Ryzen 7 7840HS") and appends their PassMark CPU Benchmark
rank inline, in red.

The dataset is a hardcoded snapshot of
[cpubenchmark.net/cpu-list/all](https://www.cpubenchmark.net/cpu-list/all)
(6041 CPUs, name/mark/rank), scraped 2026-10-06.

## Install (unpacked)

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**, select this folder
4. Click the extension's toolbar icon on any site to toggle scanning for
   that site (click again to turn off)

## How matching works

- Visible text nodes on the page are tokenized on whitespace/hyphen
  boundaries.
- Brand filler words (`Intel`, `AMD`, `Apple`, `Core`, `Processor`, `CPU`)
  are normalized away.
- A sliding window (1-4 tokens) is checked against a lookup built from the
  dataset's normalized names, longest window first.
- On a hit, the original text is left untouched and a red badge is
  appended: `(Intel Core i5-1235U, PassMark rank #1555)`.

## Files

- `data/cpu-data.js` -- hardcoded `[name, mark, rank]` list scraped from
  PassMark.
- `content.js` -- scans the page and injects rank badges, per-site gated
  via `chrome.storage.local`.
- `background.js` -- toolbar icon click toggles the scan on/off for the
  active tab's site.
- `test_matcher.mjs` -- `node test_matcher.mjs`, self-check for the
  matching logic.

## Limitations

- One-time scan on enable/page-load -- no `MutationObserver`, so CPU names
  injected into the DOM afterwards (SPA navigation, infinite scroll) aren't
  picked up until you re-toggle.
- Apple M-series rarely matches: PassMark names them with core-count/clock
  suffixes (e.g. `Apple M2 Pro 10 Core 3480 MHz`), which plain text like
  "M2 Pro" can't disambiguate.

## License

GPL-3.0-or-later, see [LICENSE](LICENSE).
