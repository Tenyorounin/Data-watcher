const {
  normalizeLine,
  normalizeFunctionalStatus
} = require('./helpers');

function isTitleLine(line) {
  const text = normalizeLine(line);
  const match = text.match(/^(\d{4})\s+(.+)$/i);
  if (!match) return false;

  const year = Number(match[1]);
  const rest = match[2] || '';
  const currentYear = new Date().getFullYear();

  if (year < 1980 || year > currentYear + 2) return false;

  const badPatterns = [
    /IAA Holdings/i,
    /All Rights Reserved/i,
    /Auction Rules/i,
    /Privacy Policy/i,
    /SMS Terms/i,
    /Accessibility/i,
    /Cookie Preferences/i,
    /Manage Cookies/i,
    /I Understand/i
  ];

  if (badPatterns.some(rx => rx.test(text))) return false;
  if (!/^[A-Z0-9][A-Z0-9\s\-./()+,&]+$/i.test(rest)) return false;

  return true;
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
    'SORT',
    'Seller Login',
    'Contact us',
    'Global Locations',
    'Buyer Login',
    'Join AuctionNow',
    'Public Auctions',
    'Site Sales',
    'Buy Now',
    'Locations',
    'Auction Rules/Buyer Agreement',
    'Our Services',
    'Buyers',
    'Sellers',
    'Vendors',
    'Seller Services Contact',
    'Transportation Contact',
    'Branch Contact',
    'Careers',
    'FAQs',
    'How To Pay IAA',
    'AFC',
    'Register Now',
    'Manage Cookies',
    'Download',
    'I Understand'
  ].includes(line) || /^\d+Vehicles$/i.test(line);
}

function trimJoinedText(text) {
  let out = normalizeLine(text);

  out = out.replace(/\s+Prebid available\s+\d+\s+per page\s+\d+-\d+\s+of\s+\d+.*$/i, ' Prebid available');
  out = out.replace(/\s+\d+\s+per page\s+\d+-\d+\s+of\s+\d+.*$/i, '');
  out = out.replace(/\s+COMPANY\s+About Us.*$/i, '');
  out = out.replace(/\s+HELP\s+How to Buy.*$/i, '');
  out = out.replace(/\s+SITE PREFERENCES\s+English.*$/i, '');
  out = out.replace(/\s+\d{4}\s+IAA Holdings, LLC\..*$/i, '');

  return out.trim();
}

function extractBrandingFromLocation(location) {
  const normalizedLocation = normalizeLine(location);
  if (!normalizedLocation) return '';

  const hyphenMatch = normalizedLocation.match(/-([A-Z0-9][A-Z0-9.\sÀ-ÿ]+)$/i);
  if (hyphenMatch) {
    return normalizeLine(hyphenMatch[1]);
  }

  const knownBrandings = [
    'NOT BRANDED',
    'SALVAGE',
    'REBUILT',
    'IRREPARABLE',
    'IRRECUPERABLE',
    'IRRÉCUPÉRABLE',
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

function extractBrandingFromJoined(joined) {
  return (
    (joined.match(
      /Vehicle Brand:\s*(.+?)(?=\s+Start Code:|\s+Lane:|\s+Run:|\s+Location:|\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+High Pre-Bid:|\s+Current Bid:|\s+Buy Now:|\s+Prebid available|$)/i
    ) || [])[1] || ''
  );
}

function extractStartCodeFromJoined(joined) {
  return (
    (joined.match(
      /Start Code:\s*(.+?)(?=\s+Vehicle Brand:|\s+Lane:|\s+Run:|\s+Location:|\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+High Pre-Bid:|\s+Current Bid:|\s+Buy Now:|\s+Prebid available|$)/i
    ) || [])[1] || ''
  );
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

  const titleCandidate = lines.find(isTitleLine) || '';
  const title = isTitleLine(titleCandidate) ? titleCandidate : '';

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
    (joined.match(/Engine:\s*(.+?)(?=\s+[A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?)*\s+(?:Lane:|Location:|Vehicle Brand:|Start Code:)|\s+Lane:|\s+Location:|\s+Vehicle Brand:|\s+Start Code:|\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),|\s+Closing Date:|\s+Prebid available|$)/i) || [])[1] || '';

  let city =
    (joined.match(/Engine:\s*.+?\s+([A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?)*)(?=\s+(?:Lane:|Location:|Vehicle Brand:|Start Code:))/i) || [])[1] || '';

  if (!city) {
    city =
      (joined.match(/Transmission:\s*Auto\s+(?:RunAndDrive|Run and Drive|Starts|Stationary)\s+Engine:\s*.+?\s+([A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?(?:\s+[A-Z][A-Za-zÀ-ÿ]+(?:\s*\([^)]+\))?)*)(?=\s+(?:Location:|Vehicle Brand:|Start Code:))/i) || [])[1] || '';
  }

  const startCodeRaw = extractStartCodeFromJoined(joined);

  const functionalStatusRaw =
    startCodeRaw ||
    (joined.match(/Transmission:\s*Auto\s+(RunAndDrive|Run and Drive|Starts|Stationary)\b/i) || [])[1] || '';

  const functionalStatus = normalizeFunctionalStatus(functionalStatusRaw);

  const normalizedLocation = normalizeLine(location);

  const explicitBranding = normalizeLine(extractBrandingFromJoined(joined));
  const branding = explicitBranding || extractBrandingFromLocation(normalizedLocation);

  const locationName = extractLocationName(normalizedLocation, branding);

  const parseIssue = !title;
  const parseIssueReason = parseIssue ? 'missing_valid_title' : '';

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
    parse_issue: parseIssue,
    parse_issue_reason: parseIssueReason,
    raw_text: joined
  };
}

function buildBlocksFromLines(lines) {
  const useful = lines.filter(line => !looksLikeNoise(line));

  const blocks = [];
  let current = [];
  let startedResults = false;

  for (const line of useful) {
    if (isTitleLine(line)) {
      startedResults = true;

      if (current.length) {
        blocks.push(current);
      }
      current = [line];
      continue;
    }

    if (!startedResults) {
      continue;
    }

    if (current.length) {
      current.push(line);
    }
  }

  if (current.length) {
    blocks.push(current);
  }

  return blocks;
}

module.exports = {
  isTitleLine,
  looksLikeNoise,
  trimJoinedText,
  extractBrandingFromLocation,
  extractBrandingFromJoined,
  extractStartCodeFromJoined,
  extractLocationName,
  parseBlock,
  buildBlocksFromLines
};
