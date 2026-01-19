-- Support tickets/contact form submissions table
-- This table stores user inquiries and support requests

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL if not authenticated
  email TEXT NOT NULL, -- Email for response
  subject TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('general', 'technical', 'billing', 'bug', 'suggestion', 'other')),
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  admin_response TEXT, -- Response from admin
  admin_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Admin who responded
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can create tickets (their own if authenticated, or anonymous)
CREATE POLICY "Users can create tickets" ON support_tickets FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL OR email IS NOT NULL);

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON support_tickets FOR SELECT 
  USING (user_id = auth.uid() OR user_id IS NULL);

-- Admins can view all tickets (will be handled through service role client in API)
-- For now, only service role can access all tickets

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_support_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_support_tickets_updated_at();
