const fs = require('fs');
const path = require('path');

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

function field(label, value) {
  if (!value) return '';
  return `<div class="field"><strong>${esc(label)}:</strong> ${esc(value)}</div>`;
}

const raw = fs.readFileSync(inputPath, 'utf8');
const items = JSON.parse(raw);

const cards = items.map(item => {
  const title = item.title || 'Untitled';

  return `
    <article class="card">
      <div class="card-head">
        <h2>${esc(title)}</h2>
        <div class="links">
          ${item.detail_page ? `<a href="${esc(item.detail_page)}" target="_blank" rel="noopener noreferrer">Detail</a>` : ''}
          ${item.image_page ? `<a href="${esc(item.image_page)}" target="_blank" rel="noopener noreferrer">Images</a>` : ''}
        </div>
      </div>

      <div class="grid">
        ${field('Search term', item.search_term)}
        ${field('VIN', item.vin)}
        ${field('Stock', item.stock_number)}
        ${field('Sale date', item.sale_datetime)}
        ${field('Closing date', item.closing_date)}
        ${field('City', item.city)}
        ${field('Lane', item.lane)}
        ${field('Run', item.run)}
        ${field('Location', item.location)}
        ${field('Location name', item.location_name)}
        ${field('Branding', item.branding)}
        ${field('Status', item.functional_status)}
        ${field('Engine', item.engine)}
        ${field('KM', item.odometer_km)}
        ${field('Damage estimate', item.damage_estimate ? `$${item.damage_estimate}` : '')}
        ${field('High pre-bid', item.high_pre_bid ? `$${item.high_pre_bid}` : '')}
        ${field('Buy now', item.buy_now ? `$${item.buy_now}` : '')}
        ${field('Result page', item.result_page)}
      </div>
    </article>
  `;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily Listings</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f4f4f4;
      color: #111;
    }

    header {
      background: #111;
      color: white;
      padding: 16px;
      position: sticky;
      top: 0;
      z-index: 10;
    }

    header h1 {
      margin: 0 0 6px 0;
      font-size: 20px;
    }

    .meta {
      font-size: 14px;
      opacity: 0.9;
    }

    main {
      padding: 14px;
      display: grid;
      gap: 12px;
    }

    .card {
      background: white;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 1px 5px rgba(0,0,0,0.08);
    }

    .card-head {
      margin-bottom: 10px;
    }

    h2 {
      margin: 0 0 8px 0;
      font-size: 18px;
      line-height: 1.3;
    }

    .links a {
      margin-right: 12px;
      text-decoration: none;
    }

    .grid {
      display: grid;
      gap: 6px;
    }

    .field {
      font-size: 14px;
      line-height: 1.35;
    }

    @media (min-width: 900px) {
      main {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Daily Listings</h1>
    <div class="meta">Total items: ${items.length}</div>
  </header>
  <main>
    ${cards || '<p>No items found.</p>'}
  </main>
</body>
</html>`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html, 'utf8');

console.log(`Wrote ${outputPath}`);
