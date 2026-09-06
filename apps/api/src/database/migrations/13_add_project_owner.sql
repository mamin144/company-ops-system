-- الجهة المالكة للمشروع (owner) — مفهوم منفصل عن العميل (client):
-- العميل هو من نتعامل معه تعاقديًا، والجهة المالكة هي صاحبة المشروع
-- (تظهر في العقود والمستخلصات). يتبع نفس نمط حقول النصوص: NOT NULL DEFAULT ''.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner VARCHAR(300) NOT NULL DEFAULT '';
