function brandingClass(value) {
  const v = String(value || '').trim().toLowerCase();
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
  const v = String(value || '').trim().toLowerCase();
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
  ].map(x => String(x || '').trim()).join(' ').toLowerCase();

  return combined.includes('repossessed') || combined.includes('repo');
}

module.exports = {
  brandingClass,
  statusClass,
  isRepossessed
};
