import * as XLSX from 'xlsx';

export interface ExcelPreviewResult {
  headers: string[];
  validRows: Record<string, unknown>[];
  invalidRows: Array<{ rowNumber: number; errors: string[]; row: Record<string, unknown> }>;
}

export interface SheetPreview {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export class ExcelService {
  parseBuffer(buffer: Buffer) {
    return XLSX.read(buffer, { type: 'buffer' });
  }

  /** Return all sheet names from a workbook buffer. */
  getSheetNames(buffer: Buffer): string[] {
    const workbook = this.parseBuffer(buffer);
    return workbook.SheetNames;
  }

  /**
   * Parse a specific sheet by name (or the first sheet if omitted).
   * Returns raw headers, rows, and total row count for smart import analysis.
   */
  previewSheet(buffer: Buffer, sheetName?: string): SheetPreview {
    const workbook = this.parseBuffer(buffer);
    const name = sheetName ?? workbook.SheetNames[0];
    const sheet = workbook.Sheets[name];
    if (!sheet) {
      return { sheetName: name, headers: [], rows: [], totalRows: 0 };
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    return { sheetName: name, headers, rows, totalRows: rows.length };
  }

  preview(buffer: Buffer, mapper: (row: Record<string, unknown>, rowNumber: number) => { value?: unknown; errors?: string[] }): ExcelPreviewResult {
    const workbook = this.parseBuffer(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    const headers = rows.length ? Object.keys(rows[0]) : [];
    const validRows: Record<string, unknown>[] = [];
    const invalidRows: Array<{ rowNumber: number; errors: string[]; row: Record<string, unknown> }> = [];
    rows.forEach((row, index) => {
      const mapped = mapper(row, index + 2);
      if (mapped.errors?.length) invalidRows.push({ rowNumber: index + 2, errors: mapped.errors, row });
      else if (mapped.value) validRows.push(mapped.value as Record<string, unknown>);
    });
    return { headers, validRows, invalidRows };
  }

  exportJson<T>(items: T[], sheetName = 'Export') {
    const worksheet = XLSX.utils.json_to_sheet(items as Record<string, unknown>[]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}

export const excelService = new ExcelService();
