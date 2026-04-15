CREATE TABLE IF NOT EXISTS compliance_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'federal' CHECK (category IN ('federal', 'state', 'registration', 'internal', 'other')),
  due_date DATE,
  recurrence TEXT DEFAULT 'annual' CHECK (recurrence IN ('annual', 'biennial', 'monthly', 'quarterly', 'one-time')),
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'filed', 'confirmed', 'waived', 'overdue')),
  responsible_party TEXT,
  filing_fee NUMERIC(10,2),
  notes TEXT,
  external_url TEXT,
  reminder_days INT DEFAULT 30,
  last_filed_date DATE,
  next_due_date DATE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compliance_item_id UUID REFERENCES compliance_items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  file_url TEXT,
  file_name TEXT,
  document_type TEXT DEFAULT 'filing' CHECK (document_type IN ('filing', 'receipt', 'confirmation', 'correspondence', 'other')),
  filed_date DATE,
  notes TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed standard nonprofit compliance items for Steel Hearts
INSERT INTO compliance_items (title, description, category, due_date, recurrence, responsible_party, filing_fee, notes, sort_order) VALUES
('IRS Form 990-EZ', 'Annual informational return filed with IRS. Due 15th day of 5th month after fiscal year end. Steel Hearts fiscal year = calendar year, so due May 15.', 'federal', '2026-05-15', 'annual', 'Tracy Hutter (CPA)', 0, 'EIN: 47-2511085. Tracy Hutter handles filing. Joseph reviews and signs.', 1),
('SC Charitable Solicitation Registration', 'South Carolina requires annual renewal for charities soliciting donations in SC. Due May 15 each year.', 'state', '2026-05-15', 'annual', 'Joseph Wiseman', 50, 'SC Secretary of State. Renew at sos.sc.gov/charities', 2),
('VA Charitable Solicitation Registration', 'Virginia requires registration for charities soliciting in VA.', 'state', NULL, 'annual', 'Joseph Wiseman', 100, 'VA Office of Charitable and Regulatory Programs', 3),
('CFC (Combined Federal Campaign)', 'Annual application to participate in the Combined Federal Campaign federal employee giving program.', 'registration', NULL, 'annual', 'Joseph Wiseman', 0, 'Applications typically open in summer. CFC participation allows federal employees to donate via payroll deduction.', 4),
('Registered Agent — South Carolina', 'Maintain registered agent in South Carolina for legal service of process.', 'state', NULL, 'annual', 'Joseph Wiseman', 0, 'Verify current registered agent is active and address is correct.', 5),
('Directors & Officers Insurance Renewal', 'Annual D&O insurance policy renewal.', 'internal', NULL, 'annual', 'Joseph Wiseman', 0, 'Protects board members from personal liability.', 6),
('Annual Board Meeting Minutes', 'Document annual board meeting with resolutions, officer elections, and key votes.', 'internal', NULL, 'annual', 'Joseph Wiseman', 0, 'Required for good governance. File with organizational records.', 7),
('Conflict of Interest Policy Review', 'Annual board acknowledgment of conflict of interest policy.', 'internal', NULL, 'annual', 'Joseph Wiseman', 0, 'Each board member signs annually. Required for 990.', 8)
ON CONFLICT DO NOTHING;
