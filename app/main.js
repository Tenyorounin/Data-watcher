const { chromium } = require('playwright');
const fs = require('fs');

function cleanText(value) {
  return (value || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();
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
    'SORT'
  ].includes(line) || /^\d+Vehicles$/i.test(line);
}

function trimJoinedText(text) {
  let out = normalizeLine(text);

  out = out.replace(/\s+Prebid available\s+\d+\s+per page\s+\d+-\d+\s+of\s+\d+.*$/i, ' Prebid available');
  out = out.replace(/\s+\d+\s+per page\s+\d+-\d+\s+of\s+\d+.*$/i, '');
  out = out.replace(/\s+COMPANY\s+About Us.*$/i, '');
  out = out.replace(/\s+HELP\s+How to Buy.*$/i, '');
  out = out.replace(/\s+SITE PREFERENCES\s+English.*$/i, '');

  return out.trim();
}

function normalizeFunctionalStatus(value) {
  const v = normalizeLine(value).toLowerCase();
  if (!v) return '';

  if (v === 'runanddrive' || v === 'run and drive') return 'Run and Drive';
  if (v === 'starts') return 'Starts';
  if (v === 'stationary') return 'Stationary';

  return normalizeLine(value);
}

function extractBrandingFromLocation(location) {
  const normalizedLocation = normalizeLine(location);
  if (!normalizedLocation) return '';

  const hyphenMatch = normalizedLocation.match(/-([A-Z0-9][A-Z0-9.\s]+)$/i);
  if (hyphenMatch) {
    return normalizeLine(hyphenMatch[1]);
  }

  const knownBrandings = [
    'NOT BRANDED',
    'SALVAGE',
    'REBUILT',
    'IRREPARABLE',
    'NON-REPAIRABLE',
    'NON REPAIRABLE',
    'CLEAN TITLE',
    'V.G.A'
  ];

  for (const candidate of knownBrandings) {
    const pattern = new RegExp(`\\b${candidate.replace(/\./g, '\\.').replace(/\s+/g, '\\s+')}\\b$`, 'i');
    if (pattern.test(normalizedLocation)) {
      return candidate;
    }
  }

  return '';
}

function extractLocationName(location, branding) {
  let locationName = normalizeLine(location);
  if (!locationName || !branding) return locationName;

  const escapedBranding = branding
    .replace(/\./g, '\\.')
    .replace(/\s+/g, '\\s+');

  locationName = locationName
    .replace(new RegExp(`-${escapedBranding}$`, 'i'), '')
    .replace(new RegExp(`\\b${escapedBranding}\\b$`, 'i'), '')
    .trim();

  return normalizeLine(locationName);
}

function parseBlock(lines) {
  const joined = trimJoinedText(lines.join(' '));

  const title = lines.find(isTitleLine) || '';
  const vin = (joined.match(/VIN\s*#:\s*([A-Z0-9*]+)/i) || [])[1] || '';
  const stock = (joined.match(/Stock\s*#:\s*([A-Z0-9-]+)/i) || [])[1] || '';
  const saleDate = (joined.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{2},\s+\d{2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,4}\b/) || [])[0] || '';
  const closingDate = (joined.match(/Closing Date:\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{2},\s+\d{4})/i) || [])[1] || '';
  const lane = (joined.match(/Lane:\s*([^\s]+)/i) || [])[1] || '';
  const run = (joined.match(/Run:\s*([^\s]+)/i) || [])[1] || '';
  const buyNow = (joined.match(/Buy Now:\s*\$([0-9,]+\.\d{2})/i) || [])[1] || '';
  const highPreBid = (joined.match(/High Pre-Bid:\s*\$([0-9,]+\.\d{2})/i) || [])[1] || '';
  const odometer = (joined.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\s*Km\b/i) || [])[1] || '';
  const damageEstimate = (joined.match(/Damage Estimate:\s*\$([0-9,]+\.\d{2})/i) || [])[1] || '';

  const location =
    (joined.match(/Location:\s*(.+?)(?=\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+High Pre-Bid:|\s+Current Bid:|\s+Buy Now:|\s+Prebid available|$)/i) || [])[1] || '';

  const engine =
    (joined.match(/Engine:\s*(.+?)(?=\s+[A-Z][A-Za-z]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-z]+(?:\s*\([^)]+\))?)*\s+(?:Lane:|Location:)|\s+Lane:|\s+Location:|\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+Prebid available|$)/i) || [])[1] || '';

  let city =
    (joined.match(/Engine:\s*.+?\s+([A-Z][A-Za-z]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-z]+(?:\s*\([^)]+\))?)*)(?=\s+(?:Lane:|Location:))/i) || [])[1] || '';

  if (!city) {
    city =
      (joined.match(/Transmission:\s*Auto\s+(?:RunAndDrive|Run and Drive|Starts|Stationary)\s+Engine:\s*.+?\s+([A-Z][A-Za-z]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-z]+(?:\s*\([^)]+\))?)*)(?=\s+Location:)/i) || [])[1] || '';
  }

  const functionalStatusRaw =
    (joined.match(/Transmission:\s*Auto\s+(RunAndDrive|Run and Drive|Starts|Stationary)\b/i) || [])[1] || '';

  const functionalStatus = normalizeFunctionalStatus(functionalStatusRaw);

  const normalizedLocation = normalizeLine(location);
  const branding = extractBrandingFromLocation(normalizedLocation);
  const locationName = extractLocationName(normalizedLocation, branding);

  return {
    title: normalizeLine(title),
    vin: normalizeLine(vin),
    stock_number: normalizeLine(stock),
    sale_datetime: normalizeLine(saleDate),
    closing_date: normalizeLine(closingDate),
    city: normalizeLine(city),
    lane: normalizeLine(lane),
    run: normalizeLine(run),
    location: normalizedLocation,
    location_name: locationName,
    branding,
    high_pre_bid: normalizeLine(highPreBid),
    buy_now: normalizeLine(buyNow),
    engine: normalizeLine(engine),
    functional_status: functionalStatus,
    odometer_km: odometer ? odometer.replace(/,/g, '') : '',
    damage_estimate: normalizeLine(damageEstimate),
    raw_text: joined
  };
}

function buildBlocksFromLines(lines) {
  const useful = lines.filter(line => !looksLikeNoise(line));

  const blocks = [];
  let current = [];

  for (const line of useful) {
    if (isTitleLine(line)) {
      if (current.length) blocks.push(current);
      current = [line];
    } else if (current.length) {
      current.push(line);
    }
  }

  if (current.length) blocks.push(current);
  return blocks;
}

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

  // Try explicit Next controls first
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

  // Fallback: infer next numeric page from current selected page
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

    // last fallback: look for a visible pagination-like numeric link after "1"
    const links = Array.from(document.querySelectorAll('a[href]'));
    const candidates = links
      .map(a => ({
        text: (a.textContent || '').trim(),
        href: a.href || ''
      }))
      .filter(x => /^\d+$/.test(x.text));

    if (candidates.length > 0) {
      // Just take the smallest numeric link greater than 1
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
