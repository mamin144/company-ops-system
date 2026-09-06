-- 1. Update existing documents to map old English categories to new Arabic ones
UPDATE documents SET category = 'عقد' WHERE category IN ('Contracts', 'doc-contract', 'contract');
UPDATE documents SET category = 'مقايسة' WHERE category IN ('BOQ', 'boq');
UPDATE documents SET category = 'رسومات' WHERE category IN ('Drawings', 'doc-drawing', 'drawings');
UPDATE documents SET category = 'تقارير' WHERE category = 'Reports';
UPDATE documents SET category = 'خطاب' WHERE category = 'Correspondence';
UPDATE documents SET category = 'مستخلص' WHERE category = 'Invoices';
UPDATE documents SET category = 'أخرى' WHERE category IN ('Other', 'Technical Documents');

-- 2. Delete all existing document categories to ensure a clean slate
DELETE FROM categories WHERE "group" = 'document-category';

-- 3. Insert the unified Arabic categories
INSERT INTO categories (id, code, name, "group") VALUES 
  (uuid_generate_v4(), 'contract', 'عقد', 'document-category'),
  (uuid_generate_v4(), 'boq', 'مقايسة', 'document-category'),
  (uuid_generate_v4(), 'ipc', 'مستخلص', 'document-category'),
  (uuid_generate_v4(), 'deduction', 'استقطاع', 'document-category'),
  (uuid_generate_v4(), 'letter', 'خطاب', 'document-category'),
  (uuid_generate_v4(), 'security-approval', 'موافقات أمنية', 'document-category'),
  (uuid_generate_v4(), 'handover', 'محضر استلام', 'document-category'),
  (uuid_generate_v4(), 'bank-guarantee', 'ضمان بنكي', 'document-category'),
  (uuid_generate_v4(), 'company-paper', 'ورق شركة', 'document-category'),
  (uuid_generate_v4(), 'drawings', 'رسومات', 'document-category'),
  (uuid_generate_v4(), 'reports', 'تقارير', 'document-category'),
  (uuid_generate_v4(), 'other', 'أخرى', 'document-category')
ON CONFLICT (code) DO NOTHING;
