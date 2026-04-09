const fs = require('fs');
const path = require('path');
const pageTemplate = require('./page_template');

const inputDataPath = path.join(__dirname, 'data.json');
const logicPath = path.join(__dirname, 'page_logic.js');

const outputDir = path.join(__dirname, '..', 'docs');
const outputHtmlPath = path.join(outputDir, 'index.html');
const outputLogicPath = path.join(outputDir, 'page_logic.js');
const outputDataPath = path.join(outputDir, 'data.json');

const html = pageTemplate();

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputHtmlPath, html, 'utf8');
fs.copyFileSync(logicPath, outputLogicPath);
fs.copyFileSync(inputDataPath, outputDataPath);

console.log(`Wrote ${outputHtmlPath}`);
console.log(`Copied ${outputLogicPath}`);
console.log(`Copied ${outputDataPath}`);
