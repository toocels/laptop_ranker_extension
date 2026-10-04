// Self-check for the matching logic in content.js (normalize + sliding-window lookup).
// Run with: node test_matcher.mjs
import fs from 'node:fs';
import assert from 'node:assert';

const src = fs.readFileSync(new URL('./data/cpu-data.js', import.meta.url), 'utf8');
const jsonMatch = src.match(/self\.CPU_DATA = (\[.*\]);/);
const self = { CPU_DATA: JSON.parse(jsonMatch[1]) };

const STOPWORDS = new Set(['intel', 'amd', 'apple', 'core', 'processor', 'cpu']);
const MAX_WINDOW = 4;
const ORDINAL_RE = /^\d{1,2}(st|nd|rd|th)$/;
const GEN_RE = /^gen(eration)?$/;

function normalize(str) {
  const cleaned = str.replace(/@\s*[\d.]+\s*ghz/gi, '');
  return cleaned
    .split(/\s+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t && !STOPWORDS.has(t))
    .map((t) => t.replace(/[^a-z0-9]/g, ''))
    .filter(Boolean)
    .join('');
}

const index = new Map();
for (const [name, mark, rank] of self.CPU_DATA) {
  const key = normalize(name);
  if (key && !index.has(key)) index.set(key, { name, mark, rank });
}

function tokenize(text) {
  const tokens = [];
  const re = /[A-Za-z0-9][A-Za-z0-9-]*/g;
  let m;
  while ((m = re.exec(text))) tokens.push(m[0]);
  return tokens;
}

function significantTokens(rawTokens) {
  const sig = [];
  let afterSeries = false;
  for (const t of rawTokens) {
    const low = t.toLowerCase();
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

function findFirstMatch(text) {
  const tokens = significantTokens(tokenize(text));
  for (let i = 0; i < tokens.length; i++) {
    const maxLen = Math.min(MAX_WINDOW, tokens.length - i);
    for (let len = maxLen; len >= 1; len--) {
      const key = tokens.slice(i, i + len).map(normalize).join('');
      if (key && index.has(key)) return index.get(key);
    }
  }
  return null;
}

assert.strictEqual(self.CPU_DATA.length, 6041, 'dataset row count');

let m = findFirstMatch('This laptop has an Intel i5 1235u and 16GB RAM.');
assert.ok(m && m.name === 'Intel Core i5-1235U' && m.rank === 1555, `i5 1235u -> ${JSON.stringify(m)}`);

m = findFirstMatch('Powered by AMD Ryzen 7 7840HS for great battery life.');
assert.ok(m && m.name === 'AMD Ryzen 7 7840HS' && m.rank === 635, `ryzen 7840hs -> ${JSON.stringify(m)}`);

m = findFirstMatch('Intel Core i7-13700H review');
assert.ok(m && m.rank === 744, `hyphenated i7-13700H -> ${JSON.stringify(m)}`);

m = findFirstMatch('Just some regular text about a laptop bag.');
assert.strictEqual(m, null, `expected no match, got ${JSON.stringify(m)}`);

// Real listing titles that broke the original contiguous-window matcher: "Series N"
// and "Nth Gen" sit between the brand tier and the model number.
m = findFirstMatch('HP Omnibook 3 Next Gen AI PC, 2K OLED Intel Core 5 Series 3 315 - (12 GB/512 GB SSD/Windows 11 Home) 14-ht0242TU Laptop');
assert.ok(m && m.name === 'Intel Core 5 315' && m.rank === 1385, `Core 5 Series 3 315 -> ${JSON.stringify(m)}`);

m = findFirstMatch('MSI Katana 15 Intel Core i5 13th Gen 13420H - (16 GB/1 TB SSD/Windows 11 Home)');
assert.ok(m && m.name === 'Intel Core i5-13420H' && m.rank === 1255, `i5 13th Gen 13420H -> ${JSON.stringify(m)}`);

m = findFirstMatch('ASUS Vivobook 14 (2025) with Office 2024 + M365 Basic*, Backlit Keyboard, Intel Core Ultra 5 225H - (16 GB/512 GB SSD/Windows 11 Home)');
assert.ok(m && m.name === 'Intel Core Ultra 5 225H' && m.rank === 647, `Core Ultra 5 225H -> ${JSON.stringify(m)}`);

console.log('all matcher self-checks passed');
