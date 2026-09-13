import { normalizeHeader } from './header-normalizer.js';

export type MatchConfidence = 'high' | 'medium' | 'low' | 'none';
export type MappingStatus = 'matched' | 'needs-review' | 'extra';

export interface FieldMapping {
  excelHeader: string;
  normalizedHeader: string;
  systemField: string | null;
  confidence: MatchConfidence;
  status: MappingStatus;
  sampleValues: string[];
}

export interface MappingResult {
  mappings: FieldMapping[];
  missingRequired: string[];
  missingOptional: string[];
  extraColumns: string[];
}

const DOCUMENT_FIELD_ALIASES: Record<string, string[]> = {
  title:          ['عنوان', 'عنوان المستند', 'document title', 'name', 'اسم المستند', 'الاسم', 'وصف', 'الموضوع', 'subject', 'description', 'doc name'],
  documentNumber: ['رقم المستند', 'document no', 'doc no', 'document number', 'رقم', 'الرقم', 'رقم الملف', 'رقم الوثيقة', 'ref', 'reference', 'reference number', 'مرجع', 'رقم مرجعي'],
  category:       ['التصنيف', 'الفئة', 'نوع', 'category', 'type', 'classification', 'تصنيف', 'فئة'],
  documentType:   ['نوع المستند', 'document type', 'doctype', 'doc type'],
  documentDate:   ['التاريخ', 'تاريخ', 'تاريخ المستند', 'date', 'document date', 'issue date', 'تاريخ الاصدار'],
  projectId:      ['المشروع', 'كود المشروع', 'رقم المشروع', 'project', 'project code', 'project name', 'projectcode', 'اسم المشروع'],
  revision:       ['المراجعة', 'الاصدار', 'revision', 'rev', 'version', 'ver', 'إصدار'],
  uploadedBy:     ['رفع بواسطة', 'uploaded by', 'المستخدم', 'user', 'uploader', 'اسم المستخدم', 'بواسطة', 'by'],
  status:         ['الحالة', 'status', 'state', 'حالة'],
  notes:          ['ملاحظات', 'notes', 'remarks', 'comments', 'تعليقات', 'ملاحظة'],
  tags:           ['الوسوم', 'tags', 'labels', 'علامات', 'كلمات مفتاحية', 'keywords'],
  siteId:         ['الموقع', 'site', 'site name', 'site code', 'موقع', 'اسم الموقع'],
  ipcId:          ['المستخلص', 'ipc', 'ipc number', 'رقم المستخلص', 'شهادة الدفع'],
};

export function matchFields(
  excelHeaders: string[],
  sampleRows: Record<string, unknown>[],
  entity?: string
): MappingResult {
  const mappings: FieldMapping[] = [];
  const requiredFields = ['title', 'category'];
  const allFields = Object.keys(DOCUMENT_FIELD_ALIASES);
  const optionalFields = allFields.filter(f => !requiredFields.includes(f));
  const matchedFields = new Set<string>();
  const extraColumns: string[] = [];

  for (const header of excelHeaders) {
    const normalizedHeader = normalizeHeader(header);
    
    let systemField: string | null = null;
    let confidence: MatchConfidence = 'none';
    let status: MappingStatus = 'extra';

    // 1. Exact match after normalization
    for (const field of allFields) {
      if (normalizeHeader(field) === normalizedHeader) {
        systemField = field;
        confidence = 'high';
        status = 'matched';
        break;
      }
    }

    // 2. Alias dictionary match
    if (!systemField) {
      for (const [field, aliases] of Object.entries(DOCUMENT_FIELD_ALIASES)) {
        if (aliases.some(alias => normalizeHeader(alias) === normalizedHeader)) {
          systemField = field;
          confidence = 'high';
          status = 'matched';
          break;
        }
      }
    }

    // 3. Substring containment of core term
    if (!systemField) {
      for (const [field, aliases] of Object.entries(DOCUMENT_FIELD_ALIASES)) {
        const normField = normalizeHeader(field);
        if (
          normalizedHeader.includes(normField) ||
          aliases.some(alias => normalizedHeader.includes(normalizeHeader(alias)))
        ) {
          systemField = field;
          confidence = 'medium';
          status = 'needs-review';
          break;
        }
      }
    }

    if (systemField) {
      matchedFields.add(systemField);
    } else {
      extraColumns.push(header);
    }

    // Extract sample values
    const sampleValues = sampleRows
      .map(row => String(row[header] ?? ''))
      .filter(val => val.trim() !== '')
      .slice(0, 3);

    mappings.push({
      excelHeader: header,
      normalizedHeader,
      systemField,
      confidence,
      status,
      sampleValues,
    });
  }

  const missingRequired = requiredFields.filter(f => !matchedFields.has(f));
  const missingOptional = optionalFields.filter(f => !matchedFields.has(f));

  return {
    mappings,
    missingRequired,
    missingOptional,
    extraColumns,
  };
}
