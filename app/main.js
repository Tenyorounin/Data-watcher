const { chromium } = require('playwright');
const fs = require('fs');
const { collectPageData, goToNextPage } = require('./pagination');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const terms = JSON.parse(fs.readFileSync('terms.json', 'utf8'));
  const allData = [];
  const seenSignatures = new Set();

  try {
    for (const term of terms) {
      console.log(`Searching: ${term}`);

      await page.goto('https://ca.iaai.com/', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(5000);

      const box = page.locator('input').first();
      await box.click({ timeout: 10000 });
      await box.fill(term, { timeout: 10000 });
      await page.keyboard.press('Enter');

      await page.waitForTimeout(7000);

      let pageNumber = 1;
      const maxPages = 20;

      while (pageNumber <= maxPages) {
        const { pageData, signature } = await collectPageData(page, term, pageNumber);

        if (!signature || seenSignatures.has(`${term}::${signature}`)) {
          console.log(`Stopping ${term} at page ${pageNumber} because the page signature repeated or was empty.`);
          break;
        }

        seenSignatures.add(`${term}::${signature}`);
        allData.push(...pageData);

        const safeTerm = term.replace(/[^a-z0-9]/gi, '_');
        await page.screenshot({
          path: `debug-${safeTerm}-p${pageNumber}.png`,
          fullPage: true
        }).catch(() => {});

        const moved = await goToNextPage(page);
        if (!moved) {
          console.log(`No next page found for ${term} after page ${pageNumber}.`);
          break;
        }

        pageNumber += 1;
      }
    }

    fs.writeFileSync('data.json', JSON.stringify(allData, null, 2));
    console.log(`Saved ${allData.length} parsed records`);
  } catch (err) {
    console.error('Task failed:', err);
    await page.screenshot({ path: 'failure.png', fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
})();
