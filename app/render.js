const fs = require('fs');
const path = require('path');
const template = require('./page_template');

const data = fs.readFileSync('./app/data.json', 'utf8');

const dataScript = `
const items = ${data};
initPage(items);
`;

const html = template(dataScript);

fs.mkdirSync('./docs', { recursive: true });
fs.writeFileSync('./docs/index.html', html);
fs.copyFileSync('./app/page_logic.js', './docs/page_logic.js');

console.log("Page built");
