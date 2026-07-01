-- Notification Queue Table - Increment 1: Foundations
-- Persistent queue for email notifications with retry logic

CREATE TABLE IF NOT EXISTS notification_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  tenant_id INTEGER NOT NULL,
  recipients TEXT NOT NULL, -- JSON array
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  metadata TEXT, -- JSON object
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')),
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_queue_status 
ON notification_queue(status, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_queue_tenant 
ON notification_queue(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_queue_retry 
ON notification_queue(status, retry_count);

-- Note: Trigger removed for SQLite compatibility
-- Updated_at will be managed by application code
