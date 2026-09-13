/**
 * Normalize a header string for comparison:
 * 1. Trim whitespace
 * 2. Lowercase
 * 3. Remove punctuation (. , ( ) : ; ' " etc.)
 * 4. Replace separators (_, -, /) with nothing
 * 5. Collapse multiple spaces to single space
 * 6. Keep Arabic Unicode intact
 */
export function normalizeHeader(raw: string): string {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[.,():;'"!?[\]{}<>]/g, '') // Remove punctuation
    .replace(/[_/\\-]/g, '')             // Replace separators with nothing
    .replace(/\s+/g, ' ')                // Collapse multiple spaces
    .trim();
}

/**
 * Detect the header row from sheet data.
 * SheetJS sheet_to_json already handles this, but we may need
 * to skip empty rows or rows that look like titles.
 */
export function isLikelyHeaderRow(values: unknown[]): boolean {
  if (!Array.isArray(values) || values.length === 0) return false;
  
  // A row is likely a header if it contains multiple string values and no numbers or dates.
  const stringCount = values.filter(
    (v) => typeof v === 'string' && v.trim().length > 0
  ).length;
  
  const otherCount = values.length - stringCount;
  
  return stringCount > 1 && otherCount === 0;
}
