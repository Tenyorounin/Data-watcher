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

  function isLikelyGasVehicle(item) {
    const engine = safe(item.engine).toLowerCase();
    const raw = safe(item.raw_text).toLowerCase();

    if (engine === 'electric' || engine === 'n' || engine === 'u u' || engine === 'u x') {
      return false;
    }

    if (raw.includes('electric')) return false;

    if (engine && engine !== 'electric') return true;

    if (raw.includes('gas') || raw.includes('diesel') || raw.includes('hybrid')) {
      return true;
    }

    return false;
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
    ].join('');

    return (
      '<article class="card ' + (repo ? 'repossessed' : '') + '">' +
        '<h2>' + (safe(item.title) || 'Untitled') + '</h2>' +
        '<div class="badges">' + badges + '</div>' +
        '<div class="top-meta-row">' + topMeta + '</div>' +
        '<div class="grid">' +
          field('Location', item.location_name) +
          field('KM', item.odometer_km) +
          field('Damage', item.damage_estimate) +
        '</div>' +
      '</article>'
    );
  }

  function applyFilters() {
    const hideGas = document.getElementById('hideGasFilter').value === 'yes';

    const filtered = items.filter(item => {
      if (hideGas && isLikelyGasVehicle(item)) return false;
      return true;
    });

    document.getElementById('results').innerHTML =
      filtered.map(card).join('');
  }

  document.getElementById('hideGasFilter')
    .addEventListener('change', applyFilters);

  applyFilters();
}
