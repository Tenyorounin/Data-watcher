const { chromium } = require('playwright');
const fs = require('fs');

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const terms = JSON.parse(fs.readFileSync('terms.json', 'utf8'));
  let allData = [];

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

      await page.waitForTimeout(6000);

      // Try several likely repeated container selectors.
      const candidateSelectors = [
        '[class*="vehicle"]',
        '[class*="result"]',
        '[class*="card"]',
        '[class*="listing"]',
        'article',
        '.card',
        '.search-result',
        '.vehicle-card'
      ];

      let chosenSelector = '';
      let chosenCount = 0;

      for (const selector of candidateSelectors) {
        const count = await page.locator(selector).count().catch(() => 0);
        console.log(`Selector ${selector} -> ${count}`);

        if (count > chosenCount && count < 200) {
          chosenSelector = selector;
          chosenCount = count;
        }
      }

      console.log(`Chosen selector for ${term}: ${chosenSelector} (${chosenCount})`);

      let records = [];

      if (chosenSelector) {
        records = await page.$$eval(chosenSelector, nodes =>
          nodes.map(node => {
            const text = (node.innerText || '').replace(/\s+/g, ' ').trim();

            const links = Array.from(node.querySelectorAll('a')).map(a => ({
              text: (a.innerText || '').replace(/\s+/g, ' ').trim(),
              href: a.href || ''
            }));

            return { text, links };
          })
        );
      }

      // Keep only containers that actually contain a detail link.
      const filtered = records
        .map(item => {
          const detail = item.links.find(link =>
            link.href && link.href.startsWith('https://ca.iaai.com/vehicle-details/')
          );

          const image = item.links.find(link =>
            (link.text || '').toLowerCase().includes('view all images')
          );

          return {
            search_term: term,
            raw_text: item.text,
            detail_page: detail ? detail.href : '',
            image_page: image ? image.href : '',
            links: item.links
          };
        })
        .filter(item => item.detail_page);

      console.log(`Filtered records for ${term}: ${filtered.length}`);
      allData.push(...filtered);

      await page.screenshot({ path: `debug-${term.replace(/[^a-z0-9]/gi, '_')}.png`, fullPage: true }).catch(() => {});
      await page.waitForTimeout(2000);
    }

    // Deduplicate by detail page
    const unique = {};
    for (const item of allData) {
      if (item.detail_page) unique[item.detail_page] = item;
    }

    const final = Object.values(unique);
    fs.writeFileSync('data.json', JSON.stringify(final, null, 2));
    console.log(`Saved ${final.length} result containers`);
  } catch (err) {
    console.error('Task failed:', err);
    await page.screenshot({ path: 'failure.png', fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
})();
