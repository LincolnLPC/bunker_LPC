-- Moderation System Tables
-- This script creates tables for reports, bans, and admin management

-- Reports table - stores user reports/complaints
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  room_id UUID REFERENCES game_rooms(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('cheating', 'harassment', 'spam', 'inappropriate_content', 'other')),
  description TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports(reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);

-- Bans table - stores user bans
CREATE TABLE IF NOT EXISTS bans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  banned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent')),
  expires_at TIMESTAMPTZ, -- NULL for permanent bans
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate active bans for the same user using partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_ban 
  ON bans (user_id) 
  WHERE is_active = true;

-- Indexes for bans
CREATE INDEX IF NOT EXISTS idx_bans_user_id ON bans(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_is_active ON bans(is_active);
CREATE INDEX IF NOT EXISTS idx_bans_expires_at ON bans(expires_at) WHERE expires_at IS NOT NULL;

-- Admin roles table - defines admin users
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  granted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One role per user
  UNIQUE(user_id)
);

-- Index for admin roles
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);

-- Enable RLS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
-- Users can create reports
CREATE POLICY "Users can create reports" ON reports
  FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- Users can view their own reports
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT
  USING (auth.uid() = reporter_id);

-- Admins can view all reports
CREATE POLICY "Admins can view all reports" ON reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- Admins can update reports
CREATE POLICY "Admins can update reports" ON reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- RLS Policies for bans
-- Users can view their own ban status
CREATE POLICY "Users can view own bans" ON bans
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all bans
CREATE POLICY "Admins can view all bans" ON bans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- Admins can create bans
CREATE POLICY "Admins can create bans" ON bans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- Admins can update bans
CREATE POLICY "Admins can update bans" ON bans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles
      WHERE admin_roles.user_id = auth.uid()
    )
  );

-- RLS Policies for admin_roles
-- Only admins can view admin roles (to prevent enumeration)
CREATE POLICY "Admins can view admin roles" ON admin_roles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM admin_roles ar
      WHERE ar.user_id = auth.uid()
    )
  );

-- Function to check if user is admin or moderator
CREATE OR REPLACE FUNCTION is_admin_or_moderator(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM admin_roles
    WHERE user_id = check_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is banned
CREATE OR REPLACE FUNCTION is_user_banned(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bans
    WHERE user_id = check_user_id
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically deactivate expired bans
CREATE OR REPLACE FUNCTION deactivate_expired_bans()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE bans
  SET is_active = false, updated_at = NOW()
  WHERE is_active = true
  AND expires_at IS NOT NULL
  AND expires_at <= NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bans_updated_at
  BEFORE UPDATE ON bans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment tables
COMMENT ON TABLE reports IS 'User reports/complaints about other users';
COMMENT ON TABLE bans IS 'User bans (temporary or permanent)';
COMMENT ON TABLE admin_roles IS 'Admin and moderator roles';
COMMENT ON FUNCTION is_admin_or_moderator IS 'Check if user has admin or moderator role';
COMMENT ON FUNCTION is_user_banned IS 'Check if user is currently banned';
COMMENT ON FUNCTION deactivate_expired_bans IS 'Deactivate bans that have expired';
