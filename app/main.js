const { chromium } = require('playwright');
const fs = require('fs');

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function parseCardText(rawText) {
  const text = cleanText(rawText);

  const titleMatch = text.match(/^\d{4}\s+[A-Z0-9][A-Z0-9\s\-\.\/]*?(?=View All Images|VIN|Stock|Mon,|Tue,|Wed,|Thu,|Fri,|Sat,|Sun,|$)/i);
  const vinMatch = text.match(/VIN\s*#:\s*([A-Z0-9*]+)/i);
  const stockMatch = text.match(/Stock\s*#:\s*([A-Z0-9-]+)/i);
  const dateMatch = text.match(/\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+[A-Za-z]{3}\s+\d{2},\s+\d{2}:\d{2}\s+(?:AM|PM)\s+[A-Z]{2,4}\b/);
  const laneRunMatch = text.match(/Lane:\s*([^\s]+)\s+Run:\s*([^\s]+)/i);
  const locationMatch = text.match(/Location:\s*([^$]+?)(?=Starts|High Pre-Bid:|Current Bid:|Buy Now:|$)/i);
  const highPreBidMatch = text.match(/High Pre-Bid:\s*\$([0-9,]+\.\d{2})/i);
  const currentBidMatch = text.match(/Current Bid:\s*\$([0-9,]+\.\d{2})/i);
  const buyNowMatch = text.match(/Buy Now:\s*\$([0-9,]+\.\d{2})/i);

  let city = '';
  if (dateMatch) {
    const afterDate = text.slice(text.indexOf(dateMatch[0]) + dateMatch[0].length).trim();
    const cityMatch = afterDate.match(/^(.+?)(?=Lane:|Run:|Location:|Starts|High Pre-Bid:|Current Bid:|Buy Now:|$)/i);
    if (cityMatch) {
      city = cleanText(cityMatch[1]);
    }
  }

  return {
    title: titleMatch ? cleanText(titleMatch[0]) : '',
    vin: vinMatch ? vinMatch[1] : '',
    stock_number: stockMatch ? stockMatch[1] : '',
    sale_datetime: dateMatch ? dateMatch[0] : '',
    city,
    lane: laneRunMatch ? cleanText(laneRunMatch[1]) : '',
    run: laneRunMatch ? cleanText(laneRunMatch[2]) : '',
    location: locationMatch ? cleanText(locationMatch[1]) : '',
    high_pre_bid: highPreBidMatch ? highPreBidMatch[1] : '',
    current_bid: currentBidMatch ? currentBidMatch[1] : '',
    buy_now: buyNowMatch ? buyNowMatch[1] : ''
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

        function findContainer(node) {
          let current = node;
          for (let i = 0; i < 6 && current; i++) {
            const text = cleanText(current.innerText || '');
            if (text.length > 40) return current;
            current = current.parentElement;
          }
          return node.parentElement || node;
        }

        return links.map(link => {
          const detailPage = link.href || '';
          const container = findContainer(link);
          const rawText = cleanText(container.innerText || '');

          const allLinks = Array.from(container.querySelectorAll('a')).map(a => ({
            text: cleanText(a.innerText || ''),
            href: a.href || ''
          }));

          const imageLink = allLinks.find(a =>
            a.text.toLowerCase().includes('view all images')
          );

          return {
            detail_page: detailPage,
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

      await page.screenshot({
        path: `debug-${term.replace(/[^a-z0-9]/
