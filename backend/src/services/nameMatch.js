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

// True when both names contain the same words after normalization and suffix
// stripping.  Word order does not matter; every submitted word must appear in
// the roster name (and vice-versa), so initials or abbreviations are rejected.
function namesMatch(submitted, roster) {
  const aWords = stripNameSuffix(normalizeName(submitted)).split(' ').filter(Boolean);
  const bWords = stripNameSuffix(normalizeName(roster)).split(' ').filter(Boolean);
  if (aWords.length !== bWords.length) return false;
  const bSet = new Set(bWords);
  return aWords.every(w => bSet.has(w));
}

module.exports = { normalizeName, stripNameSuffix, namesMatch };
