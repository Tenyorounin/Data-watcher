const { splitLines } = require('./helpers');
const { buildBlocksFromLines, parseBlock } = require('./parser');

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise(resolve => {
      let totalHeight = 0;
      const distance = 600;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        const scrollHeight = document.body.scrollHeight;
        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 250);
    });
  });
}

async function collectPageData(page, term, pageNumber) {
  await page.waitForTimeout(2500);
  await autoScroll(page);
  await page.waitForTimeout(2500);

  const bodyText = await page.locator('body').innerText();
  const lines = splitLines(bodyText);
  const blocks = buildBlocksFromLines(lines);

  console.log(`Found ${blocks.length} blocks for ${term} on page ${pageNumber}`);

  const detailLinks = await page.$$eval('a[href*="/vehicle-details/"]', nodes =>
    Array.from(new Set(nodes.map(n => n.href).filter(Boolean)))
  );

  console.log(`Found ${detailLinks.length} detail links for ${term} on page ${pageNumber}`);

  const imageLinks = await page.$$eval('[href]', nodes =>
    nodes
      .filter(n => ((n.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase() === 'view all images'))
      .map(n => n.getAttribute('href') || '')
      .filter(Boolean)
  );

  console.log(`Found ${imageLinks.length} image links for ${term} on page ${pageNumber}`);

  const count = Math.min(blocks.length, detailLinks.length);
  const pageData = [];

  for (let i = 0; i < count; i++) {
    const parsed = parseBlock(blocks[i]);
    pageData.push({
      search_term: term,
      result_page: pageNumber,
      detail_page: detailLinks[i],
      image_page: imageLinks[i] || '',
      ...parsed
    });
  }

  return {
    pageData,
    signature: detailLinks.join('|')
  };
}

async function goToNextPage(page) {
  const currentUrl = page.url();

  const nextCandidates = [
    page.getByRole('link', { name: /next/i }),
    page.getByRole('button', { name: /next/i }),
    page.locator('a[aria-label*="next" i], button[aria-label*="next" i]'),
    page.locator('a[title*="next" i], button[title*="next" i]'),
    page.locator('a:has-text("Next"), button:has-text("Next")')
  ];

  for (const locator of nextCandidates) {
    try {
      const count = await locator.count();
      for (let i = 0; i < count; i++) {
        const item = locator.nth(i);
        if (await item.isVisible().catch(() => false)) {
          await Promise.all([
            page.waitForLoadState('domcontentloaded').catch(() => {}),
            item.click({ timeout: 5000 })
          ]);
          await page.waitForTimeout(3000);
          if (page.url() !== currentUrl) return true;
          return true;
        }
      }
    } catch (_) {}
  }

  const nextHref = await page.evaluate(() => {
    const current =
      document.querySelector('[aria-current="page"]') ||
      document.querySelector('.active') ||
      document.querySelector('.selected') ||
      document.querySelector('.current');

    if (current) {
      const currentNum = parseInt((current.textContent || '').trim(), 10);
      if (!Number.isNaN(currentNum)) {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const nextNumeric = links.find(a => parseInt((a.textContent || '').trim(), 10) === currentNum + 1);
        if (nextNumeric) return nextNumeric.href;
      }
    }

    const links = Array.from(document.querySelectorAll('a[href]'));
    const candidates = links
      .map(a => ({
        text: (a.textContent || '').trim(),
        href: a.href || ''
      }))
      .filter(x => /^\d+$/.test(x.text));

    if (candidates.length > 0) {
      const sorted = candidates
        .map(x => ({ ...x, num: parseInt(x.text, 10) }))
        .sort((a, b) => a.num - b.num);

      const candidate = sorted.find(x => x.num > 1);
      return candidate ? candidate.href : '';
    }

    return '';
  });

  if (nextHref) {
    await page.goto(nextHref, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(3000);
    return true;
  }

  return false;
}

module.exports = {
  autoScroll,
  collectPageData,
  goToNextPage
};
