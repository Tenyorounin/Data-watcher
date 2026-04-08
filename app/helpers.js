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

function normalizeFunctionalStatus(value) {
  const v = normalizeLine(value).toLowerCase();
  if (!v) return '';

  if (v === 'runanddrive' || v === 'run and drive') return 'Run and Drive';
  if (v === 'starts') return 'Starts';
  if (v === 'stationary') return 'Stationary';

  return normalizeLine(value);
}

module.exports = {
  cleanText,
  normalizeLine,
  splitLines,
  normalizeFunctionalStatus
};
