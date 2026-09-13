import type { Project } from '@cos/shared';

export interface TransformOptions {
  mapping: Array<{ excelHeader: string; systemField: string | null }>;
  projects: Project[];  // for resolving project names/codes to IDs
  defaultCategory?: string;
  importedBy?: string;
}

export interface TransformedRow {
  data: Record<string, unknown>;
  extraData: Record<string, string>;  // unmapped columns
  warnings: string[];
}

function parseFlexDate(val: unknown): string | undefined {
  if (!val) return undefined;
  
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return undefined;
    return val.toISOString();
  }

  if (typeof val === 'number') {
    // Excel serial number date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    epoch.setDate(epoch.getDate() + val);
    if (isNaN(epoch.getTime())) return undefined;
    return epoch.toISOString();
  }

  if (typeof val === 'string') {
    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = val.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const [_, d, m, y] = dmyMatch;
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    // YYYY-MM-DD
    const ymdMatch = val.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (ymdMatch) {
      const [_, y, m, d] = ymdMatch;
      const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      if (!isNaN(date.getTime())) return date.toISOString();
    }
    
    // Try native parse
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date.toISOString();
  }

  return undefined;
}

const VALID_STATUSES = ['draft', 'submitted', 'under-review', 'approved', 'rejected', 'superseded', 'archived'];

export function transformRow(
  row: Record<string, unknown>,
  options: TransformOptions,
): TransformedRow {
  const data: Record<string, unknown> = {};
  const extraData: Record<string, string> = {};
  const warnings: string[] = [];

  for (const { excelHeader, systemField } of options.mapping) {
    const rawValue = row[excelHeader];
    if (rawValue === undefined || rawValue === null || rawValue === '') {
      continue;
    }

    if (systemField) {
      data[systemField] = rawValue;
    } else {
      extraData[excelHeader] = String(rawValue);
    }
  }

  // Resolve projectId
  if (data.projectId && options.projects.length) {
    const pVal = String(data.projectId).trim().toLowerCase();
    const matchedProject = options.projects.find(p => 
      p.id.toLowerCase() === pVal || 
      p.projectName.toLowerCase() === pVal ||
      p.projectCode.toLowerCase() === pVal
    );
    if (matchedProject) {
      data.projectId = matchedProject.id;
    } else {
      warnings.push(`المشروع "${data.projectId}" غير موجود في النظام`);
      data.projectId = null;
    }
  }

  // Parse dates
  if (data.documentDate) {
    const parsed = parseFlexDate(data.documentDate);
    if (parsed) {
      data.documentDate = parsed;
    } else {
      warnings.push(`Invalid document date format: ${data.documentDate}`);
      data.documentDate = null;
    }
  }

  // Parse tags
  if (data.tags) {
    if (typeof data.tags === 'string') {
      data.tags = data.tags.split(',').map(t => t.trim()).filter(Boolean);
    } else if (!Array.isArray(data.tags)) {
      data.tags = [];
    }
  } else {
    data.tags = [];
  }

  // Status
  if (data.status) {
    const statusStr = String(data.status).toLowerCase();
    if (VALID_STATUSES.includes(statusStr)) {
      data.status = statusStr;
    } else {
      warnings.push(`Invalid status "${data.status}". Defaulting to draft.`);
      data.status = 'draft';
    }
  } else {
    data.status = 'draft';
  }

  // Default category
  if (!data.category && options.defaultCategory) {
    data.category = options.defaultCategory;
  }

  // Imported by
  if (options.importedBy && !data.uploadedBy) {
    data.uploadedBy = options.importedBy;
  }

  // Build notes appendix
  const extraKeys = Object.keys(extraData);
  if (extraKeys.length > 0) {
    let appendix = '\n\n--- بيانات إضافية من الاستيراد ---\n';
    for (const key of extraKeys) {
      appendix += `${key}: ${extraData[key]}\n`;
    }
    
    if (data.notes) {
      data.notes = String(data.notes) + appendix;
    } else {
      data.notes = appendix.trim();
    }
  }

  return {
    data,
    extraData,
    warnings
  };
}
