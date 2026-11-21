-- ============================================================
-- 063_village_departments.sql
-- Editable department officer numbers per workspace
-- ============================================================

CREATE TABLE IF NOT EXISTS village_departments (
  id TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📋',
  phone TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, id)
);

CREATE INDEX IF NOT EXISTS idx_village_departments_account ON village_departments(account_id);

ALTER TABLE village_departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on village_departments" ON village_departments;
CREATE POLICY "Allow all for authenticated on village_departments" ON village_departments FOR ALL TO authenticated USING (true);
