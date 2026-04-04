const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const terms = JSON.parse(fs.readFileSync('terms.json'));

  let results = [];

  for (const term of terms) {
    console.log(`Searching: ${term}`);

    await page.goto('https://ca.iaai.com/');
    await page.waitForSelector('input');

    await page.fill('input', term);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(5000);

    const items = await page.$$eval('a', els =>
      els.map(e => ({
        text: e.innerText,
        href: e.href
      }))
    );

    results.push(...items);
  }

  const unique = {};
  results.forEach(r => {
    unique[r.href] = r;
  });

  const final = Object.values(unique);

  fs.writeFileSync('data.json', JSON.stringify(final, null, 2));

  await browser.close();
})();
