const { chromium } = require('playwright');
const fs = require('fs');

function isListingLink(item) {
  if (!item || !item.href) return false;

  const href = item.href.trim();
  const text = (item.text || '').replace(/\s+/g, ' ').trim();

  if (!href.startsWith('https://ca.iaai.com/vehicle-details/')) return false;
  if (!text) return false;

  return true;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const terms = JSON.parse(fs.readFileSync('terms.json', 'utf8'));
  let results = [];

  try {
    for (const term of terms) {
      console.log(`Searching: ${term}`);

      await page.goto('https://ca.iaai.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const allInputs = await page.locator('input').count();
      console.log(`Found ${allInputs} input elements`);

      if (allInputs === 0) {
        throw new Error('No input elements found on page');
      }

      const box = page.locator('input').first();
      await box.click({ timeout: 10000 });
      await box.fill(term, { timeout: 10000 });
      await page.keyboard.press('Enter');

      await page.waitForTimeout(6000);

      const rawItems = await page.$$eval('a', els =>
        els.map(e => ({
          text: (e.innerText || '').replace(/\s+/g, ' ').trim(),
          href: e.href || ''
        }))
      );

      const listingItems = rawItems.filter(item =>
        item.href.startsWith('https://ca.iaai.com/vehicle-details/') && item.text
      );

      console.log(`Collected ${listingItems.length} listing links for ${term}`);
      results.push(...listingItems);
    }

    const unique = {};
    for (const item of results) {
      if (isListingLink(item)) {
        unique[item.href] = item;
      }
    }

    const final = Object.values(unique).sort((a, b) => a.text.localeCompare(b.text));

    fs.writeFileSync('data.json', JSON.stringify(final, null, 2));
    console.log(`Saved ${final.length} unique listing items`);
  } catch (err) {
    console.error('Task failed:', err);
    await page.screenshot({ path: 'failure.png', fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
})();
