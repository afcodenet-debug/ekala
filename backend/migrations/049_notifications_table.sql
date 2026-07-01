-- Create notifications table for Supabase
-- Based on SQLite schema from database/database.db

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,                    -- e.g. 'newQrOrder', 'stockLow', 'orderAssigned'...
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',   -- low | medium | high | critical
  notification_type TEXT,                -- optional category (NEW_QR_ORDER, STOCK_LOW...)
  metadata JSONB,                        -- JSON data (flexible)
  link TEXT,                             -- deep link e.g. '/orders?highlight=123'
  user_id UUID,                          -- target user (optional for role-based)
  role TEXT,                             -- target role (admin, manager, cashier, waiter)
  read_at TIMESTAMPTZ,                   -- NULL means unread
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_created 
  ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user 
  ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_role 
  ON notifications(role);

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(read_at) 
  WHERE read_at IS NULL;

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
  ON notifications
  FOR SELECT
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
  ON notifications
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()) OR user_id IS NULL);

-- Policy: Service role can do everything
CREATE POLICY "Service role has full access"
  ON notifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON notifications TO service_role;
GRANT SELECT, UPDATE ON notifications TO authenticated;
