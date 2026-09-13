import * as XLSX from 'xlsx';
import fs from 'fs';

// Scenario 1 & 3: Clean Arabic headers, different order
const sheet1 = [
  { 'الرقم': 'DOC-001', 'عنوان المستند': 'Test Doc 1', 'التصنيف': 'Report', 'تاريخ': '2023-01-01', 'الحالة': 'draft' }
];

// Scenario 2, 5, 6, 7, 8, 9, 15: Mixed headers, missing columns (no Category), extra columns, empty cells, low-confidence
const sheet2 = [
  { 'doc no': 'DOC-002', 'Name': 'Test Doc 2', 'Date': '05/06/2023', 'Random Extra': 'keep this', 'Another Extra': 'and this', 'status': '' },
  { 'doc no': 'DOC-003', 'Name': 'Test Doc 3', 'Date': '06/06/2023', 'Random Extra': 'info', 'Another Extra': 'more info', 'status': 'approved' }
];

// Scenario 10, 11, 12: Date formats & Invalid Dates
const sheet3 = [
  { 'رقم المستند': 'DOC-004', 'عنوان المستند': 'Date Test 1', 'التصنيف': 'Plan', 'Date': '2024-02-30' }, // Invalid date
  { 'رقم المستند': 'DOC-005', 'عنوان المستند': 'Date Test 2', 'التصنيف': 'Plan', 'Date': 45200 }, // Excel Serialized
  { 'رقم المستند': 'DOC-006', 'عنوان المستند': 'Date Test 3', 'التصنيف': 'Plan', 'Date': '12-05-2023' } // DD-MM-YYYY
];

// Scenario 13: Duplicates
const sheet4 = [
  { 'رقم المستند': 'DOC-001', 'عنوان المستند': 'Duplicate 1', 'التصنيف': 'Report' }, // Will conflict with sheet1 if imported together, or existing DB
  { 'رقم المستند': 'DOC-001', 'عنوان المستند': 'Duplicate 2', 'التصنيف': 'Report' }  // Intra-sheet duplicate
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), 'Clean Arabic');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), 'Mixed & Extra');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3), 'Dates');
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4), 'Duplicates');

XLSX.writeFile(wb, 'test-smart-import.xlsx');
console.log('Created test-smart-import.xlsx');
