const fs = require('fs');
const path = require('path');
const pageTemplate = require('./page_template');

const inputDataPath = path.join(__dirname, 'data.json');
const logicPath = path.join(__dirname, 'page_logic.js');

const outputDir = path.join(__dirname, '..', 'docs');
const outputHtmlPath = path.join(outputDir, 'index.html');
const outputLogicPath = path.join(outputDir, 'page_logic.js');
const outputDataPath = path.join(outputDir, 'data.json');

// LOAD DATA
const rawItems = JSON.parse(fs.readFileSync(inputDataPath, 'utf8'));

// DEDUPE
const seen = new Set();

const dedupedItems = rawItems.filter(item => {
  const key = item.detail_page || item.stock_number;

  if (!key) return true; // keep malformed for debugging

  if (seen.has(key)) {
    return false;
  }

  seen.add(key);
  return true;
});

// BUILD PAGE
const html = pageTemplate();

fs.mkdirSync(outputDir, { recursive: true });

// WRITE FILES
fs.writeFileSync(outputHtmlPath, html, 'utf8');
fs.copyFileSync(logicPath, outputLogicPath);

// WRITE DEDUPED DATA
fs.writeFileSync(outputDataPath, JSON.stringify(dedupedItems, null, 2));

console.log(`Wrote ${outputHtmlPath}`);
console.log(`Copied ${outputLogicPath}`);
console.log(`Wrote deduped data to ${outputDataPath}`);
