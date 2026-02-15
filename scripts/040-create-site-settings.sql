-- Site settings table for admin-controlled features
-- gate_password: when set, site shows "under development" and requires password
-- production_mode: when true, debug elements are hidden; when false, debug mode is on

CREATE TABLE IF NOT EXISTS site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  gate_password TEXT, -- NULL or empty = no gate
  production_mode BOOLEAN DEFAULT true, -- true = production (no debug), false = development (show debug)
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row (before RLS so migration can run)
INSERT INTO site_settings (id, gate_password, production_mode, updated_at)
VALUES ('main', NULL, true, NOW())
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- RLS: allow read for all, writes only via service role (API)
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (for gate check and production mode)
CREATE POLICY "Anyone can read site settings" ON site_settings
  FOR SELECT USING (true);

-- No INSERT/UPDATE policies = deny for anon/authenticated
-- API uses service role which bypasses RLS for admin updates

COMMENT ON TABLE site_settings IS 'Site-wide settings: gate password and production mode';
