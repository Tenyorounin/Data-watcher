const fs = require('fs');
const path = require('path');
const { brandingClass, statusClass, isRepossessed } = require('./render_helpers');

const inputPath = path.join(__dirname, 'data.json');
const outputDir = path.join(__dirname, '..', 'docs');
const outputPath = path.join(outputDir, 'index.html');

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const raw = fs.readFileSync(inputPath, 'utf8');
const items = JSON.parse(raw);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily Listings</title>
  <style>
    :root {
      --bg: #f3f4f6;
      --panel: #ffffff;
      --panel-2: #f9fafb;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #111827;

      --green-bg: #dcfce7;
      --green-text: #166534;

      --yellow-bg: #fef3c7;
      --yellow-text: #92400e;

      --red-bg: #fee2e2;
      --red-text: #b91c1c;

      --blue-bg: #dbeafe;
      --blue-text: #1d4ed8;

      --orange-bg: #ffedd5;
      --orange-text: #c2410c;

      --repo-bg: #fce7f3;
      --repo-text: #9d174d;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
    }

    header {
      background: var(--accent);
      color: white;
      padding: 12px 14px;
      position: sticky;
      top: 0;
      z-index: 50;
      box-shadow: 0 2px 10px rgba(0,0,0,0.15);
    }

    header h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      line-height: 1.2;
    }

    .meta {
      font-size: 13px;
      opacity: 0.92;
    }

    .toolbar {
      padding: 10px;
      display: grid;
      gap: 10px;
    }

    .controls {
      background: var(--panel);
      border-radius: 12px;
      padding: 10px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.08);
      border: 1px solid var(--border);
      display: grid;
      gap: 10px;
    }

    .controls-row {
      display: grid;
      gap: 8px;
    }

    .control {
      display: grid;
      gap: 4px;
    }

    .control label {
      font-size: 12px;
      color: var(--muted);
      font-weight: 700;
    }

    .control input,
    .control select {
      width: 100%;
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 8px 10px;
      font-size: 13px;
      background: white;
      color: var(--text);
    }

    .summary {
      background: var(--panel);
      border-radius: 12px;
      padding: 10px 12px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.08);
      border: 1px solid var(--border);
      display: grid;
      gap: 5px;
      font-size: 13px;
    }

    .summary strong {
      font-size: 17px;
    }

    main {
      padding: 0 10px 12px 10px;
      display: grid;
      gap: 10px;
    }

    .card {
      background: var(--panel);
      border-radius: 14px;
      padding: 10px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.08);
      border: 1px solid var(--border);
      display: grid;
      gap: 8px;
    }

    .card.repossessed {
      border: 2px solid var(--repo-text);
      box-shadow: 0 0 0 3px rgba(157, 23, 77, 0.08);
    }

    .card-top {
      display: grid;
      gap: 6px;
    }

    .card-title {
      display: grid;
      gap: 6px;
    }

    h2 {
      margin: 0;
      font-size: 16px;
      line-height: 1.25;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 5px 9px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      border: 1px solid transparent;
    }

    .badge.branding-green {
      background: var(--green-bg);
      color: var(--green-text);
    }

    .badge.branding-yellow {
      background: var(--yellow-bg);
      color: var(--yellow-text);
    }

    .badge.branding-red {
      background: var(--red-bg);
      color: var(--red-text);
    }

    .badge.branding-default {
      background: #e5e7eb;
      color: #374151;
    }

    .badge.status-blue {
      background: var(--blue-bg);
      color: var(--blue-text);
    }

    .badge.status-yellow {
      background: var(--yellow-bg);
      color: var(--yellow-text);
    }

    .badge.status-orange {
      background: var(--orange-bg);
      color: var(--orange-text);
    }

    .badge.status-default {
      background: #e5e7eb;
      color: #374151;
    }

    .badge.repo {
      background: var(--repo-bg);
      color: var(--repo-text);
    }

    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .links a {
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }

    .top-meta-row {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }

    .mini-field {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 7px 8px;
      min-width: 0;
    }

    .mini-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .mini-value {
      font-size: 12px;
      line-height: 1.2;
      word-break: break-word;
    }

    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }

    .field {
      background: var(--panel-2);
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 8px 10px;
      font-size: 13px;
      line-height: 1.3;
    }

    .field-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: var(--muted);
      margin-bottom: 3px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .empty {
      text-align: center;
      color: var(--muted);
      padding: 24px 12px;
      background: var(--panel);
      border-radius: 12px;
      border: 1px solid var(--border);
    }

    @media (max-width: 520px) {
      .top-meta-row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (min-width: 800px) {
      .controls-row {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .controls-row.second {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      main {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (min-width: 1200px) {
      main {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Daily Listings</h1>
    <div class="meta">Reload this page to see the latest committed data.</div>
  </header>

  <section class="toolbar">
    <div class="controls">
      <div class="controls-row">
        <div class="control">
          <label for="searchBox">Search</label>
          <input id="searchBox" type="text" placeholder="Title, VIN, stock, city, location...">
        </div>

        <div class="control">
          <label for="sortBy">Sort by</label>
          <select id="sortBy">
            <option value="title-asc">Vehicle A–Z</option>
            <option value="title-desc">Vehicle Z–A</option>
            <option value="location-asc">Location A–Z</option>
            <option value="branding-asc">Branding A–Z</option>
            <option value="status-asc">Status A–Z</option>
            <option value="damage-desc">Damage estimate high to low</option>
            <option value="damage-asc">Damage estimate low to high</option>
            <option value="bid-desc">Pre-bid high to low</option>
            <option value="bid-asc">Pre-bid low to high</option>
            <option value="km-asc">KM low to high</option>
            <option value="km-desc">KM high to low</option>
          </select>
        </div>

        <div class="control">
          <label for="vehicleFilter">Vehicle</label>
          <select id="vehicleFilter">
            <option value="">All</option>
          </select>
        </div>
      </div>

      <div class="controls-row second">
        <div class="control">
          <label for="locationFilter">Location</label>
          <select id="locationFilter">
            <option value="">All</option>
          </select>
        </div>

        <div class="control">
          <label for="statusFilter">Status</label>
          <select id="statusFilter">
            <option value="">All</option>
          </select>
        </div>

        <div class="control">
          <label for="brandingFilter">Branding</label>
          <select id="brandingFilter">
            <option value="">All</option>
          </select>
        </div>

        <div class="control">
          <label for="repoFilter">Repossessed</label>
          <select id="repoFilter">
            <option value="">All</option>
            <option value="yes">Repossessed only</option>
            <option value="no">Exclude repossessed</option>
          </select>
        </div>
      </div>
    </div>

    <div class="summary">
      <div><strong id="countValue">0</strong> items shown</div>
      <div id="summaryText">Ready</div>
    </div>
  </section>

  <main id="results"></main>

  <script>
    const items = ${JSON.stringify(items)};

    function safe(value) {
      return String(value || '').trim();
    }

    function lower(value) {
      return safe(value).toLowerCase();
    }

    function moneyNumber(value) {
      if (!value) return null;
      const n = Number(String(value).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    function kmNumber(value) {
      if (!value) return null;
      const n = Number(String(value).replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    function vehicleKey(item) {
      const title = safe(item.title);
      const m = title.match(/^\\d{4}\\s+(.+)$/);
      return m ? m[1] : title;
    }

    function brandingClass(value) {
      const v = lower(value);
      if (!v) return 'branding-default';
      if (v.includes('not branded') || v.includes('clean')) return 'branding-green';
      if (v.includes('salvage') || v.includes('v.g.a') || v === 'vga') return 'branding-yellow';
      if (
        v.includes('irreparable') ||
        v.includes('irrecuperable') ||
        v.includes('irrécupérable') ||
        v.includes('non-repairable') ||
        v.includes('non repairable')
      ) return 'branding-red';
      return 'branding-default';
    }

    function statusClass(value) {
      const v = lower(value);
      if (v === 'run and drive') return 'status-blue';
      if (v === 'starts') return 'status-yellow';
      if (v === 'stationary') return 'status-orange';
      return 'status-default';
    }

    function isRepossessed(item) {
      const combined = [
        item.title,
        item.raw_text,
        item.branding,
        item.location,
        item.location_name
      ].map(safe).join(' ').toLowerCase();

      return combined.includes('repossessed') || combined.includes('repo');
    }

    function field(label, value) {
      if (!safe(value)) return '';
      return \`
        <div class="field">
          <span class="field-label">\${label}</span>
          \${safe(value)}
        </div>
      \`;
    }

    function miniField(label, value) {
      if (!safe(value)) return '';
      return \`
        <div class="mini-field">
          <span class="mini-label">\${label}</span>
          <div class="mini-value">\${safe(value)}</div>
        </div>
      \`;
    }

    function card(item) {
      const repo = isRepossessed(item);

      const badges = [
        item.branding ? \`<span class="badge \${brandingClass(item.branding)}">\${safe(item.branding)}</span>\` : '',
        item.functional_status ? \`<span class="badge \${statusClass(item.functional_status)}">\${safe(item.functional_status)}</span>\` : '',
        repo ? '<span class="badge repo">REPOSSESSED</span>' : ''
      ].filter(Boolean).join('');

      const topMeta = [
        miniField('Stock', item.stock_number),
        miniField('Lane', item.lane),
        miniField('Run', item.run),
        miniField('VIN', item.vin)
      ].filter(Boolean).join('');

      return \`
        <article class="card \${repo ? 'repossessed' : ''}">
          <div class="card-top">
            <div class="card-title">
              <h2>\${safe(item.title) || 'Untitled'}</h2>
              <div class="badges">\${badges}</div>
            </div>

            <div class="top-meta-row">\${topMeta}</div>

            <div class="links">
              \${item.detail_page ? \`<a href="\${safe(item.detail_page)}" target="_blank" rel="noopener noreferrer">Detail</a>\` : ''}
              \${item.image_page ? \`<a href="\${safe(item.image_page)}" target="_blank" rel="noopener noreferrer">Images</a>\` : ''}
            </div>
          </div>

          <div class="grid">
            \${field('Sale date', item.sale_datetime)}
            \${field('Closing date', item.closing_date)}
            \${field('City', item.city)}
            \${field('Location name', item.location_name)}
            \${field('KM', item.odometer_km)}
            \${field('Damage estimate', item.damage_estimate ? '$' + item.damage_estimate : '')}
            \${field('High pre-bid', item.high_pre_bid ? '$' + item.high_pre_bid : '')}
            \${field('Buy now', item.buy_now ? '$' + item.buy_now : '')}
            \${field('Search term', item.search_term)}
          </div>
        </article>
      \`;
    }

    function uniqueSorted(values) {
      return [...new Set(values.map(safe).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    }

    function fillSelect(id, values) {
      const select = document.getElementById(id);
      const current = select.value;
      const options = ['<option value="">All</option>']
        .concat(values.map(v => \`<option value="\${v.replace(/"/g, '&quot;')}">\${v}</option>\`))
        .join('');
      select.innerHTML = options;
      if (values.includes(current)) {
        select.value = current;
      }
    }

    fillSelect('vehicleFilter', uniqueSorted(items.map(vehicleKey)));
    fillSelect('locationFilter', uniqueSorted(items.map(i => i.location_name || i.location)));
    fillSelect('statusFilter', uniqueSorted(items.map(i => i.functional_status)));
    fillSelect('brandingFilter', uniqueSorted(items.map(i => i.branding)));

    function applyFilters() {
      const search = lower(document.getElementById('searchBox').value);
      const sortBy = document.getElementById('sortBy').value;
      const vehicleFilter = document.getElementById('vehicleFilter').value;
      const locationFilter = document.getElementById('locationFilter').value;
      const statusFilter = document.getElementById('statusFilter').value;
      const brandingFilter = document.getElementById('brandingFilter').value;
      const repoFilter = document.getElementById('repoFilter').value;

      let filtered = items.filter(item => {
        const repo = isRepossessed(item);

        if (vehicleFilter && vehicleKey(item) !== vehicleFilter) return false;
        if (locationFilter && safe(item.location_name || item.location) !== locationFilter) return false;
        if (statusFilter && safe(item.functional_status) !== statusFilter) return false;
        if (brandingFilter && safe(item.branding) !== brandingFilter) return false;
        if (repoFilter === 'yes' && !repo) return false;
        if (repoFilter === 'no' && repo) return false;

        if (search) {
          const haystack = [
            item.title,
            item.vin,
            item.stock_number,
            item.city,
            item.location,
            item.location_name,
            item.branding,
            item.functional_status,
            item.raw_text
          ].map(safe).join(' ').toLowerCase();

          if (!haystack.includes(search)) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'title-desc':
            return safe(b.title).localeCompare(safe(a.title));
          case 'location-asc':
            return safe(a.location_name || a.location).localeCompare(safe(b.location_name || b.location));
          case 'branding-asc':
            return safe(a.branding).localeCompare(safe(b.branding));
          case 'status-asc':
            return safe(a.functional_status).localeCompare(safe(b.functional_status));
          case 'damage-desc':
            return (moneyNumber(b.damage_estimate) ?? -1) - (moneyNumber(a.damage_estimate) ?? -1);
          case 'damage-asc':
            return (moneyNumber(a.damage_estimate) ?? Number.MAX_SAFE_INTEGER) - (moneyNumber(b.damage_estimate) ?? Number.MAX_SAFE_INTEGER);
          case 'bid-desc':
            return (moneyNumber(b.high_pre_bid) ?? -1) - (moneyNumber(a.high_pre_bid) ?? -1);
          case 'bid-asc':
            return (moneyNumber(a.high_pre_bid) ?? Number.MAX_SAFE_INTEGER) - (moneyNumber(b.high_pre_bid) ?? Number.MAX_SAFE_INTEGER);
          case 'km-desc':
            return (kmNumber(b.odometer_km) ?? -1) - (kmNumber(a.odometer_km) ?? -1);
          case 'km-asc':
            return (kmNumber(a.odometer_km) ?? Number.MAX_SAFE_INTEGER) - (kmNumber(b.odometer_km) ?? Number.MAX_SAFE_INTEGER);
          case 'title-asc':
          default:
            return safe(a.title).localeCompare(safe(b.title));
        }
      });

      const results = document.getElementById('results');
      const countValue = document.getElementById('countValue');
      const summaryText = document.getElementById('summaryText');

      countValue.textContent = String(filtered.length);

      summaryText.textContent = [
        vehicleFilter ? 'Vehicle: ' + vehicleFilter : '',
        locationFilter ? 'Location: ' + locationFilter : '',
        statusFilter ? 'Status: ' + statusFilter : '',
        brandingFilter ? 'Branding: ' + brandingFilter : '',
        repoFilter === 'yes' ? 'Repossessed only' : '',
        repoFilter === 'no' ? 'Repossessed excluded' : '',
        search ? 'Search active' : ''
      ].filter(Boolean).join(' • ') || 'Showing all items';

      if (!filtered.length) {
        results.innerHTML = '<div class="empty">No items match the current filters.</div>';
        return;
      }

      results.innerHTML = filtered.map(card).join('');
    }

    ['searchBox', 'sortBy', 'vehicleFilter', 'locationFilter', 'statusFilter', 'brandingFilter', 'repoFilter']
      .forEach(id => {
        document.getElementById(id).addEventListener('input', applyFilters);
        document.getElementById(id).addEventListener('change', applyFilters);
      });

    applyFilters();
  </script>
</body>
</html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

console.log(`Wrote ${outputPath}`);
