/**
 * Fetch CSV from URL
 */

export async function loadCSV(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load CSV: ${url}`);
  }
  return await res.text();
}
