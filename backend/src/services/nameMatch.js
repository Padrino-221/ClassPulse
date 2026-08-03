// Shared name-normalization + matching helpers.
// Used by the attendance check-in (routes/attendance.js) and the admin CSV
// roster import (routes/admin.js) so both treat roster names consistently.

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Common name suffixes found in rosters, e.g. "TWUMASI Frederica Sarpong (ms)".
// Kept to abbreviated suffixes only — spelled-out words like "Junior"/"Senior"
// are real given/surnames in some rosters and must not be stripped.
const NAME_SUFFIXES = ['ms', 'jnr', 'snr'];

// Remove trailing known suffixes from an already-normalized name.
function stripNameSuffix(normalized) {
  const words = normalized.split(' ');
  while (words.length > 0 && NAME_SUFFIXES.includes(words[words.length - 1])) {
    words.pop();
  }
  return words.join(' ');
}

// True when both names match after normalization and suffix stripping.
// Word-order or extra/missing words are rejected.
function namesMatch(submitted, roster) {
  return stripNameSuffix(normalizeName(submitted)) === stripNameSuffix(normalizeName(roster));
}

module.exports = { normalizeName, stripNameSuffix, namesMatch };
