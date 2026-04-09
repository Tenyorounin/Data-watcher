const fs = require('fs');
const path = require('path');
const pageTemplate = require('./page_template');

const inputPath = path.join(__dirname, 'data.json');
const logicPath = path.join(__dirname, 'page_logic.js');
const outputDir = path.join(__dirname, '..', 'docs');
const outputHtmlPath = path.join(outputDir, 'index.html');
const outputLogicPath = path.join(outputDir, 'page_logic.js');

const raw = fs.readFileSync(inputPath, 'utf8');
const items = JSON.parse(raw);
const itemsJson = JSON.stringify(items);

const html = pageTemplate(itemsJson);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputHtmlPath, html, 'utf8');
fs.copyFileSync(logicPath, outputLogicPath);

console.log(`Wrote ${outputHtmlPath}`);
console.log(`Copied ${outputLogicPath}`);
