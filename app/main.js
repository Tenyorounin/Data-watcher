const { chromium } = require('playwright');
const fs = require('fs');

function cleanText(value) {
  return (value || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
}

function normalizeLine(line) {
  return (line || '').replace(/\s+/g, ' ').trim();
}

function splitLines(text) {
  return cleanText(text)
    .split('\n')
    .map(normalizeLine)
    .filter(Boolean);
}

function isTitleLine(line) {
  return /^20\d{2}\s+[A-Z0-9]/i.test(line);
}

function looksLikeNoise(line) {
  return [
    'WATCH ALL',
    'FiltersClose',
    'Clear All Filters',
    'Clear',
    'Sort ByClose',
    'View All Images',
    'View More',
    '1',
    '4Vehicles',
    'SORT'
  ].includes(line);
}

function parseBlock(lines) {
  const joined = lines.join(' ');

  const title = lines.find(isTitleLine) || '';
  const vin = (joined.match(/VIN\s*#:\s*([A-Z0-9*]+)/i) || [])[1] || '';
  const stock = (joined.match(/Stock\s*#:\s*([A-Z0-9-]+)/i) || [])[1] || '';
  const saleDate = (joined.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{2},\s+\d{2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,4}\b/) || [])[0] || '';
  const closingDate = (joined.match(/Closing Date:\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{2},\s+\d{4})/i) || [])[1] || '';
  const lane = (joined.match(/Lane:\s*([^\s]+)/i) || [])[1] || '';
  const run = (joined.match(/Run:\s*([^\s]+)/i) || [])[1] || '';
  const location = (joined.match(/Location:\s*(.+?)(?=\s+Stationary|\s+Prebid available|\s+Closing Date:|\s+Buy Now:|$)/i) || [])[1] || '';
  const buyNow = (joined.match(/Buy Now:\s*\$([0-9,]+\.\d{2})/i) || [])[1] || '';
  const highPreBid = (joined.match(/High Pre-Bid:\s*\$([0-9,]+\.\d{2})/i) || [])[1] || '';

  // City is usually the standalone line after stock or after date.
  let city = '';
  for (let i = 0; i < lines.length; i++) {
    if (/^Stock\s*#:/i.test(lines[i])) {
      const next = lines[i + 1] || '';
      if (
        next &&
        !/^VIN\s*#:/i.test(next) &&
        !/^Stock\s*#:/i.test(next) &&
        !/^Lane:/i.test(next) &&
        !/^Run:/i.test(next) &&
        !/^Location:/i.test(next) &&
        !/^Stationary$/i.test(next) &&
        !/^Prebid available$/i.test(next) &&
        !/^Closing Date:/i.test(next) &&
        !/^Buy Now:/i.test(next) &&
        !/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/i.test(next)
      ) {
        city = next;
      }
    }
  }

  // If the line after stock is a date, then city is often after date.
  if (!city) {
    for (let i = 0; i < lines.length; i++) {
      if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun),/i.test(lines[i])) {
        const next = lines[i + 1] || '';
        if (
          next &&
          !/^Lane:/i.test(next) &&
          !/^Location:/i.test(next) &&
          !/^Stationary$/i.test(next) &&
          !/^Prebid available$/i.test(next)
        ) {
          city = next;
        }
      }
    }
  }

  return {
    title: normalizeLine(title),
    vin: normalizeLine(vin),
    stock_number: normalizeLine(stock),
    sale_datetime: normalizeLine(saleDate),
    closing_date: normalizeLine(closingDate),
    city: normalizeLine(city),
    lane: normalizeLine(lane),
    run: normalizeLine(run),
    location: normalizeLine(location),
    high_pre_bid: normalizeLine(highPreBid),
    buy_now: normalizeLine(buyNow),
    raw_text: joined
  };
}

function buildBlocksFromLines(lines) {
  const useful = lines.filter(line => !looksLikeNoise(line));

  const blocks = [];
  let current = [];

  for (const line of useful) {
    if (isTitleLine(line)) {
      if (current.length) {
        blocks.push(current);
      }
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const terms = JSON.parse(fs.readFileSync('terms.json', 'utf8'));
  const allData = [];

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

      const bodyText = await page.locator('body').innerText();
      const lines = splitLines(bodyText);
      const blocks = buildBlocksFromLines(lines);

      console.log(`Found ${blocks.length} blocks for ${term}`);

      const detailLinks = await page.$$eval('a[href*="/vehicle-details/"]', nodes =>
        Array.from(new Set(nodes.map(n => n.href).filter(Boolean)))
      );

      console.log(`Found ${detailLinks.length} detail links for ${term}`);

      const count = Math.min(blocks.length, detailLinks.length);
      console.log(`Pairing ${count} records for ${term}`);

      for (let i = 0; i < count; i++) {
        const parsed = parseBlock(blocks[i]);
        allData.push({
          search_term: term,
          detail_page: detailLinks[i],
          image_page: '',
          ...parsed
        });
      }

      const safeTerm = term.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({
        path: `debug-${safeTerm}.png`,
        fullPage: true
      }).catch(() => {});
    }

    const unique = {};
    for (const item of allData) {
      if (item.detail_page) unique[item.detail_page] = item;
    }

    const final = Object.values(unique);
    fs.writeFileSync('data.json', JSON.stringify(final, null, 2));
    console.log(`Saved ${final.length} parsed records`);
  } catch (err) {
    console.error('Task failed:', err);
    await page.screenshot({ path: 'failure.png', fullPage: true }).catch(() => {});
    throw err;
  } finally {
    await browser.close();
  }
})();
