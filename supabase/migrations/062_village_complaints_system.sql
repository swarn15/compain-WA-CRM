-- ============================================================
-- 062_village_complaints_system.sql
-- Village Civic Complaints and Officer Forwarding
-- ============================================================

CREATE TABLE IF NOT EXISTS complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  complaint_number TEXT NOT NULL,
  department TEXT NOT NULL,
  department_label TEXT NOT NULL,
  officer_phone TEXT NOT NULL,
  citizen_phone TEXT,
  citizen_name TEXT,
  description TEXT,
  media_url TEXT,
  media_type TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  forwarded_to_officer BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contact_complaint_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL UNIQUE REFERENCES contacts(id) ON DELETE CASCADE,
  department TEXT NOT NULL,
  department_label TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_complaints_account_id ON complaints(account_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_contact_complaint_sessions_contact_id ON contact_complaint_sessions(contact_id);

ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_complaint_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for authenticated on complaints" ON complaints;
CREATE POLICY "Allow all for authenticated on complaints" ON complaints FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow all for authenticated on contact_complaint_sessions" ON contact_complaint_sessions;
CREATE POLICY "Allow all for authenticated on contact_complaint_sessions" ON contact_complaint_sessions FOR ALL TO authenticated USING (true);
