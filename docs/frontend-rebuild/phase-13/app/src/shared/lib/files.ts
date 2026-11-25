/* ===================================================================
   CSV / JSON serialization + local download (Phase 3.7)
   Browser-only, dependency-free, and entirely local: the file is produced
   from data already in the mock store, never fetched or uploaded anywhere.
   -------------------------------------------------------------------
   · RFC 4180 quoting (commas, quotes, CR/LF inside a value).
   · UTF-8 BOM so Excel on Windows detects the encoding and renders Arabic
     text correctly instead of mojibake.
   · Formula-injection neutralization: a text cell whose first meaningful
     character is `= + - @` (or a leading tab/CR/LF) is prefixed with a
     single quote so Excel/Sheets treat it as literal text. Applied to the
     EXPORT REPRESENTATION ONLY — the mock data is never mutated.
   · Numbers stay numeric: a negative quantity must not become "'-6".
   =================================================================== */

export type Cell = string | number | boolean | null | undefined;

export interface Column { key: string; label: string }

const FORMULA_LEAD = /^\s*[=+\-@]/;
const CONTROL_LEAD = /^[\t\r\n]/;

/** One cell, neutralized and quoted. */
export const csvCell = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = String(v);
  if (FORMULA_LEAD.test(s) || CONTROL_LEAD.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Header + body, CRLF-terminated (RFC 4180). */
export const toCsv = (cols: Column[], rows: Record<string, Cell>[]): string =>
  [
    cols.map((c) => csvCell(c.label)).join(','),
    ...rows.map((r) => cols.map((c) => csvCell(r[c.key])).join(',')),
  ].join('\r\n');

/** UTF-8 BOM prefix — Excel needs it to read the Arabic text as UTF-8. */
export const CSV_BOM = '\uFEFF';

export const csvText = (cols: Column[], rows: Record<string, Cell>[]) => CSV_BOM + toCsv(cols, rows);

export const jsonText = (rows: Record<string, Cell>[]) =>
  JSON.stringify(rows.map((r) => ({ ...r })), null, 2);

export const CSV_MIME = 'text/csv;charset=utf-8';
export const JSON_MIME = 'application/json;charset=utf-8';

/**
 * Trigger a local download. Nothing leaves the browser — the Blob is built
 * from the string handed in and the object URL is revoked right after.
 */
export const downloadFile = (filename: string, mime: string, text: string) => {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};

/** Safe, ASCII-only file stem so the name survives every OS/filesystem. */
export const safeStem = (s: string) =>
  s.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export';

/* ===================================================================
   Minimal CSV parser (quotes, escaped quotes, CRLF). Browser-only use.
   Shared by the Archive and Warehouses import wizards — one parser, one
   quoting behavior, no dependencies.
   =================================================================== */
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let cur = '', row: string[] = [], inQ = false;
  const pushCell = () => { row.push(cur); cur = ''; };
  const pushRow = () => { if (row.some((v) => v.trim() !== '')) rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') pushCell();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      pushCell(); pushRow();
    } else cur += c;
  }
  pushCell(); pushRow();
  return rows;
};