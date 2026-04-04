const { chromium } = require('playwright');
const fs = require('fs');

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseCardText(rawText) {
  const text = cleanText(rawText);

  const titleMatch = text.match(/\b(20\d{2}\s+[A-Z0-9][A-Z0-9\s\-\.\/]*?)(?=\s+VIN\s*#:|\s+Stock\s*#:|\s+Damage|\s+\d+\s*Km|\s+Transmission:|\s+Engine:|\s+Lane:|\s+Location:|\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+Buy Now:|\s+Prebid available|$)/i);
  const vinMatch = text.match(/VIN\s*#:\s*([A-Z0-9*]+)/i);
  const stockMatch = text.match(/Stock\s*#:\s*([A-Z0-9-]+)/i);
  const dateMatch = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{2},\s+\d{2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,4}\b/);
  const closingDateMatch = text.match(/Closing Date:\s*([A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{2},\s+\d{4})/i);
  const laneRunMatch = text.match(/Lane:\s*([^\s]+)\s+Run:\s*([^\s]+)/i);
  const locationMatch = text.match(/Location:\s*([^$]+?)(?=Prebid available|Starts|High Pre-Bid:|Current Bid:|Buy Now:|Closing Date:|$)/i);
  const highPreBidMatch = text.match(/High Pre-Bid:\s*\$([0-9,]+\.\d{2})/i);
  const currentBidMatch = text.match(/Current Bid:\s*\$([0-9,]+\.\d{2})/i);
  const buyNowMatch = text.match(/Buy Now:\s*\$([0-9,]+\.\d{2})/i);
  const engineMatch = text.match(/Engine:\s*([^$]+?)(?=Location:|Lane:|Run:|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|Closing Date:|Buy Now:|Prebid available|$)/i);
  const odometerMatch = text.match(/\b(\d{1,3}(?:,\d{3})*|\d+)\s*Km\b/i);
  const damageEstimateMatch = text.match(/Damage Estimate:\s*\$([0-9,]+\.\d{2})/i);

  let city = '';
  if (engineMatch) {
    const tail = cleanText(engineMatch[1]);
    const pieces = tail.split(/\s+/);
    if (pieces.length > 1) {
      city = tail;
    }
  }

  return {
    title: titleMatch ? cleanText(titleMatch[1]) : '',
    vin: vinMatch ? vinMatch[1] : '',
    stock_number: stockMatch ? stockMatch[1] : '',
    sale_datetime: dateMatch ? dateMatch[0] : '',
    closing_date: closingDateMatch ? cleanText(closingDateMatch[1]) : '',
    city,
    lane: laneRunMatch ? cleanText(laneRunMatch[1]) : '',
    run: laneRunMatch ? cleanText(laneRunMatch[2]) : '',
    location: locationMatch ? cleanText(locationMatch[1]) : '',
    high_pre_bid: highPreBidMatch ? highPreBidMatch[1] : '',
    current_bid: currentBidMatch ? currentBidMatch[1] : '',
    buy_now: buyNowMatch ? buyNowMatch[1] : '',
    engine: engineMatch ? cleanText(engineMatch[1]) : '',
    odometer_km: odometerMatch ? odometerMatch[1].replace(/,/g, '') : '',
    damage_estimate: damageEstimateMatch ? damageEstimateMatch[1] : ''
  };
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

      await page.waitForTimeout(7000);

      const records = await page.$$eval('a[href*="/vehicle-details/"]', links => {
        function cleanText(value) {
          return (value || '').replace(/\s+/g, ' ').trim();
        }

        function countDetailLinks(node) {
          return node.querySelectorAll('a[href*="/vehicle-details/"]').length;
        }

        function findBestContainer(link) {
          let current = link;
          let best = null;

          for (let i = 0; i < 8 && current; i++) {
            const text = cleanText(current.innerText || '');
            const detailCount = countDetailLinks(current);

            if (text.length >= 30 && detailCount === 1) {
              best = current;
            }

            if (detailCount > 1 && best) {
              break;
            }

            current = current.parentElement;
          }

          return best || link.parentElement || link;
        }

        return links.map(link => {
          const container = findBestContainer(link);
          const rawText = cleanText(container.innerText || '');

          const allLinks = Array.from(container.querySelectorAll('a')).map(a => ({
            text: cleanText(a.innerText || ''),
            href: a.href || ''
          }));

          const imageLink = allLinks.find(a =>
            a.text.toLowerCase().includes('view all images')
          );

          return {
            detail_page: link.href || '',
            image_page: imageLink ? imageLink.href : '',
            raw_text: rawText
          };
        });
      });

      console.log(`Found ${records.length} raw result records for ${term}`);

      const parsed = records.map(record => ({
        search_term: term,
        detail_page: record.detail_page,
        image_page: record.image_page,
        raw_text: record.raw_text,
        ...parseCardText(record.raw_text)
      }));

      allData.push(...parsed);

      const safeTerm = term.replace(/[^a-z0-9]/gi, '_');
      await page.screenshot({
        path: `debug-${safeTerm}.png`,
        fullPage: true
      }).catch(() => {});

      await page.waitForTimeout(2000);
    }

    const unique = {};
    for (const item of allData) {
      if (item.detail_page) {
        unique[item.detail_page] = item;
      }
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
    
