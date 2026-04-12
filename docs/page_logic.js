function initPage(items) {
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

  function parseVehicleParts(title) {
    const text = safe(title);
    const m = text.match(/^(\d{4})\s+(\S+)(?:\s+(.*))?$/);
    if (!m) {
      return {
        year: '',
        make: '',
        model: '',
        extra: '',
        vehicle_key: text
      };
    }

    const year = m[1] || '';
    const make = m[2] || '';
    const rest = safe(m[3] || '');

    if (!rest) {
      return {
        year,
        make,
        model: '',
        extra: '',
        vehicle_key: make
      };
    }

    const restParts = rest.split(/\s+/);
    const model = restParts[0] || '';
    const extra = restParts.slice(1).join(' ');

    return {
      year,
      make,
      model,
      extra,
      vehicle_key: [make, model, extra].filter(Boolean).join(' ')
    };
  }

  const enrichedItems = items.map(item => ({
    ...item,
    vehicle_parts: parseVehicleParts(item.title)
  }));

  function vehicleKey(item) {
    return item.vehicle_parts.vehicle_key;
  }

  function brandingClass(value) {
  const v = lower(value);

  // Normalize by removing spaces and hyphens
  const normalized = v.replace(/[\s-]/g, '');

  // NOT BRANDED (all variants)
  if (normalized.includes('notbranded') ||
  normalized.includes('cleantitle') ||
  normalized.endsWith('clean') ||
  normalized.endsWith('clear')
     ) {
    return 'branding-green';
  }

  // SALVAGE / VGA
  if (
    normalized.includes('salvage') ||
    normalized.includes('vga')
  ) {
    return 'branding-yellow';
  }

  // IRREPARABLE / NON-REPAIRABLE (all variants + french)
  if (
    normalized.includes('irreparable') ||
    normalized.includes('irrecuperable') ||
    normalized.includes('nonrepairable')
  ) {
    return 'branding-red';
  }

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

  function isLikelyGasVehicle(item) {
  const engine = safe(item.engine).toLowerCase();
  const raw = safe(item.raw_text).toLowerCase();

  // Normalize: remove spaces, hyphens, punctuation
  const normEngine = engine.replace(/[\s\-_:]/g, '');
  const normRaw = raw.replace(/[\s\-_:]/g, '');

  return (
    normEngine.includes('gas') ||
    normEngine.includes('diesel') ||
    normEngine.includes('cylinder') ||

    normRaw.includes('gas') ||
    normRaw.includes('diesel') ||
    normRaw.includes('cylinder')
  );
}

  function field(label, value) {
    if (!safe(value)) return '';
    return '<div class="field"><span class="field-label">' + safe(label) + '</span>' + safe(value) + '</div>';
  }

  function miniField(label, value) {
    if (!safe(value)) return '';
    return '<div class="mini-field"><span class="mini-label">' + safe(label) + '</span><div class="mini-value">' + safe(value) + '</div></div>';
  }

  function card(item) {
    const repo = isRepossessed(item);
    const parts = item.vehicle_parts;
    const subtitle = [parts.year, parts.make, parts.model].filter(Boolean).join(' • ');

    const badges = [
      item.branding ? '<span class="badge ' + brandingClass(item.branding) + '">' + safe(item.branding) + '</span>' : '',
      item.functional_status ? '<span class="badge ' + statusClass(item.functional_status) + '">' + safe(item.functional_status) + '</span>' : '',
      repo ? '<span class="badge repo">REPOSSESSED</span>' : ''
    ].filter(Boolean).join('');

    const topMeta = [
      miniField('Stock', item.stock_number),
      miniField('Lane', item.lane),
      miniField('Run', item.run),
      miniField('VIN', item.vin)
    ].filter(Boolean).join('');

return ( '<article class="card ' + (repo ? 'repossessed' : '') + '">' + '<div class="card-top">' + '<div class="card-title">' + '<div class="vehicle-subtitle">' + (safe(subtitle) || '&nbsp;') + '</div>' + ( item.detail_page ? '<h2 class="vehicle-title"><a href="' + safe(item.detail_page) + '" target="_blank" rel="noopener noreferrer">' + (safe(item.title) || 'Untitled') + '</a></h2>' : '<h2 class="vehicle-title">' + (safe(item.title) || 'Untitled') + '</h2>' ) + '<div class="badges">' + badges + '</div>' + '</div>' + '<div class="top-meta-row">' + topMeta + '</div>' + '</div>' + '<div class="grid">' + field('Sale date', item.sale_datetime) + field('Closing date', item.closing_date) + field('City', item.city) + field('Location', item.location_name) + field('KM', item.odometer_km) + field('Damage estimate', item.damage_estimate ? '$' + item.damage_estimate : '') + field('High pre-bid', item.high_pre_bid ? '$' + item.high_pre_bid : '') + field('Buy now', item.buy_now ? '$' + item.buy_now : '') + field('Search term', item.search_term) + '</div>' + '</article>' ); }

  function uniqueSorted(values) {
    return [...new Set(values.map(safe).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }

  function fillSelect(id, values) {
    const select = document.getElementById(id);
    const current = select.value;
    const options = ['<option value="">All</option>']
      .concat(values.map(v => '<option value="' + v.replace(/"/g, '&quot;') + '">' + v + '</option>'))
      .join('');
    select.innerHTML = options;
    if (values.includes(current)) {
      select.value = current;
    }
  }

  function refreshDependentFilters() {
    const vehicleFilter = document.getElementById('vehicleFilter').value;
    const makeFilter = document.getElementById('makeFilter').value;

    let modelSource = enrichedItems.slice();

    if (vehicleFilter) {
      modelSource = modelSource.filter(item => vehicleKey(item) === vehicleFilter);
    }

    if (makeFilter) {
      modelSource = modelSource.filter(item => item.vehicle_parts.make === makeFilter);
    }

    fillSelect('modelFilter', uniqueSorted(modelSource.map(i => i.vehicle_parts.model)));
  }

  fillSelect('vehicleFilter', uniqueSorted(enrichedItems.map(vehicleKey)));
  fillSelect('locationFilter', uniqueSorted(enrichedItems.map(i => i.location_name || i.location)));
  fillSelect('statusFilter', uniqueSorted(enrichedItems.map(i => i.functional_status)));
  fillSelect('brandingFilter', uniqueSorted(enrichedItems.map(i => i.branding)));
  fillSelect('makeFilter', uniqueSorted(enrichedItems.map(i => i.vehicle_parts.make)));
  fillSelect('modelFilter', uniqueSorted(enrichedItems.map(i => i.vehicle_parts.model)));

  function applyFilters() {
    const search = lower(document.getElementById('searchBox').value);
    const sortBy = document.getElementById('sortBy').value;
    const vehicleFilter = document.getElementById('vehicleFilter').value;
    const locationFilter = document.getElementById('locationFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const brandingFilter = document.getElementById('brandingFilter').value;
    const repoFilter = document.getElementById('repoFilter').value;
    const hideGasFilter = document.getElementById('hideGasFilter').value;
    const makeFilter = document.getElementById('makeFilter').value;
    const modelFilter = document.getElementById('modelFilter').value;

    let filtered = enrichedItems.filter(item => {
      const repo = isRepossessed(item);
      const parts = item.vehicle_parts;

      if (vehicleFilter && vehicleKey(item) !== vehicleFilter) return false;
      if (locationFilter && safe(item.location_name || item.location) !== locationFilter) return false;
      if (statusFilter && safe(item.functional_status) !== statusFilter) return false;
      if (brandingFilter && safe(item.branding) !== brandingFilter) return false;
      if (repoFilter === 'yes' && !repo) return false;
      if (repoFilter === 'no' && repo) return false;
      if (hideGasFilter === 'yes' && isLikelyGasVehicle(item)) return false;
      if (makeFilter && parts.make !== makeFilter) return false;
      if (modelFilter && parts.model !== modelFilter) return false;

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
      const pa = a.vehicle_parts;
      const pb = b.vehicle_parts;

      switch (sortBy) {
        case 'title-desc':
          return safe(b.title).localeCompare(safe(a.title));
        case 'location-asc':
          return safe(a.location_name || a.location).localeCompare(safe(b.location_name || b.location));
        case 'branding-asc':
          return safe(a.branding).localeCompare(safe(b.branding));
        case 'status-asc':
          return safe(a.functional_status).localeCompare(safe(b.functional_status));
        case 'make-asc':
          return safe(pa.make).localeCompare(safe(pb.make));
        case 'model-asc':
          return safe(pa.model).localeCompare(safe(pb.model));
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
      makeFilter ? 'Make: ' + makeFilter : '',
      modelFilter ? 'Model: ' + modelFilter : '',
      locationFilter ? 'Location: ' + locationFilter : '',
      statusFilter ? 'Status: ' + statusFilter : '',
      brandingFilter ? 'Branding: ' + brandingFilter : '',
      repoFilter === 'yes' ? 'Repossessed only' : '',
      repoFilter === 'no' ? 'Repossessed excluded' : '',
      hideGasFilter === 'yes' ? 'Gas hidden' : 'Gas shown',
      search ? 'Search active' : ''
    ].filter(Boolean).join(' • ') || 'Showing all items';

    if (!filtered.length) {
      results.innerHTML = '<div class="empty">No items match the current filters.</div>';
      return;
    }

    results.innerHTML = filtered.map(card).join('');
  }

  [
    'searchBox',
    'sortBy',
    'vehicleFilter',
    'locationFilter',
    'statusFilter',
    'brandingFilter',
    'repoFilter',
    'hideGasFilter',
    'makeFilter',
    'modelFilter'
  ].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (id === 'vehicleFilter' || id === 'makeFilter') {
        refreshDependentFilters();
      }
      applyFilters();
    });
    document.getElementById(id).addEventListener('change', () => {
      if (id === 'vehicleFilter' || id === 'makeFilter') {
        refreshDependentFilters();
      }
      applyFilters();
    });
  });

  refreshDependentFilters();
  applyFilters();
}
