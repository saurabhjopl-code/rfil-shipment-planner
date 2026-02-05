/**
 * Very strict CSV parser
 * - First row = headers
 * - Trims values
 * - Empty lines ignored
 */

export function parseCSV(csvText) {
  const lines = csvText
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? "";
    });
    return row;
  });
}
