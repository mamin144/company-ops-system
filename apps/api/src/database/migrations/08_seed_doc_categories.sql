-- Seed document categories
INSERT INTO categories (id, code, name, "group") VALUES 
  (uuid_generate_v4(), 'contract', 'عقد', 'document-category'),
  (uuid_generate_v4(), 'boq', 'مقايسة', 'document-category'),
  (uuid_generate_v4(), 'ipc', 'مستخلص', 'document-category'),
  (uuid_generate_v4(), 'deduction', 'استقطاع', 'document-category'),
  (uuid_generate_v4(), 'letter', 'خطاب', 'document-category'),
  (uuid_generate_v4(), 'security-approval', 'موافقات أمنية', 'document-category'),
  (uuid_generate_v4(), 'handover', 'محضر استلام', 'document-category'),
  (uuid_generate_v4(), 'bank-guarantee', 'ضمان بنكي', 'document-category'),
  (uuid_generate_v4(), 'company-paper', 'ورق شركة', 'document-category')
ON CONFLICT (code) DO NOTHING;
