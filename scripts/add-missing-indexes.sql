-- Missing indexes identified in schema audit
CREATE INDEX IF NOT EXISTS idx_heroes_organization_id ON heroes(organization_id);
CREATE INDEX IF NOT EXISTS idx_heroes_family_contact_id ON heroes(family_contact_id);
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_order_items_created_at ON order_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_paid_at ON donations(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_messages_created_at ON family_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_volunteers_user_id ON volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_completed_at ON execution_log(completed_at DESC);
