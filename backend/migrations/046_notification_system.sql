-- Notification System V3 - Database Schema
-- Version: 1.0.0
-- Date: 2026-06-29

-- ============================================
-- TABLE: notifications
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title VARCHAR(100) NOT NULL,
    message VARCHAR(500) NOT NULL,
    body TEXT,
    category VARCHAR(50) NOT NULL CHECK (category IN ('system', 'order', 'inventory', 'table', 'staff', 'billing', 'platform')),
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('error', 'warning', 'info', 'success')),
    type VARCHAR(20) NOT NULL CHECK (type IN ('alert', 'info', 'reminder', 'update')),
    status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'queued', 'displayed', 'read', 'processed', 'archived', 'deleted', 'expired', 'failed', 'retrying')),
    read BOOLEAN DEFAULT FALSE,
    dismissed BOOLEAN DEFAULT FALSE,
    archived BOOLEAN DEFAULT FALSE,
    actionable BOOLEAN DEFAULT FALSE,
    requires_response BOOLEAN DEFAULT FALSE,
    response_deadline TIMESTAMP,
    toast BOOLEAN DEFAULT TRUE,
    badge BOOLEAN DEFAULT TRUE,
    banner BOOLEAN DEFAULT FALSE,
    center BOOLEAN DEFAULT TRUE,
    push BOOLEAN DEFAULT FALSE,
    email BOOLEAN DEFAULT FALSE,
    sms BOOLEAN DEFAULT FALSE,
    merged BOOLEAN DEFAULT FALSE,
    merged_into UUID,
    merge_count INTEGER DEFAULT 0,
    language VARCHAR(10) DEFAULT 'fr',
    timezone VARCHAR(50) DEFAULT 'Africa/Lusaka',
    sensitivity VARCHAR(20) DEFAULT 'internal' CHECK (sensitivity IN ('public', 'internal', 'confidential', 'restricted')),
    encrypted BOOLEAN DEFAULT FALSE,
    audited BOOLEAN DEFAULT TRUE,
    source VARCHAR(100),
    source_id VARCHAR(255),
    event_type VARCHAR(100),
    event_version VARCHAR(20),
    payload JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    scheduled_at TIMESTAMP,
    expires_at TIMESTAMP,
    read_at TIMESTAMP,
    processed_at TIMESTAMP,
    archived_at TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT chk_expires_at CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT chk_updated_at CHECK (updated_at >= created_at)
);

-- ============================================
-- TABLE: notification_recipients
-- ============================================
CREATE TABLE IF NOT EXISTS notification_recipients (
    recipient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    recipient_type VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (recipient_type IN ('user', 'role', 'group', 'tenant')),
    recipient_role VARCHAR(50),
    recipient_group VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'read', 'failed')),
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,
    failed_at TIMESTAMP,
    failure_reason TEXT,
    channels JSONB,
    quiet_hours JSONB,
    digest JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_notification FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE,
    CONSTRAINT uq_notification_user UNIQUE (notification_id, user_id)
);

-- ============================================
-- TABLE: notification_preferences
-- ============================================
CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    channels JSONB NOT NULL DEFAULT '{"toast": true, "badge": true, "push": true, "email": false, "sms": false, "webhook": false}',
    categories JSONB NOT NULL DEFAULT '{"system": true, "order": true, "inventory": true, "table": true, "staff": true, "billing": true, "platform": true}',
    priorities JSONB NOT NULL DEFAULT '{"critical": true, "high": true, "medium": true, "low": true}',
    quiet_hours JSONB DEFAULT '{"enabled": false, "start": "22:00", "end": "08:00", "timezone": "Africa/Lusaka", "exceptions": []}',
    digest JSONB DEFAULT '{"enabled": false, "frequency": "daily", "time": "09:00", "timezone": "Africa/Lusaka", "email": ""}',
    language VARCHAR(10) DEFAULT 'fr',
    timezone VARCHAR(50) DEFAULT 'Africa/Lusaka',
    inherited_from VARCHAR(20) DEFAULT 'user' CHECK (inherited_from IN ('user', 'role', 'tenant', 'global')),
    overrides JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_user UNIQUE (tenant_id, user_id)
);

-- ============================================
-- TABLE: notification_deliveries
-- ============================================
CREATE TABLE IF NOT EXISTS notification_deliveries (
    delivery_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    channel_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying', 'cancelled')),
    attempt INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    delivered_at TIMESTAMP,
    failed_at TIMESTAMP,
    error_code VARCHAR(50),
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    retry_delay INTEGER DEFAULT 1000,
    next_retry_at TIMESTAMP,
    retry_strategy VARCHAR(20) DEFAULT 'exponential' CHECK (retry_strategy IN ('linear', 'exponential', 'fixed')),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_delivery_notification FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE,
    CONSTRAINT fk_delivery_recipient FOREIGN KEY (recipient_id) REFERENCES notification_recipients(recipient_id) ON DELETE CASCADE,
    CONSTRAINT chk_attempt CHECK (attempt >= 1 AND attempt <= max_attempts),
    CONSTRAINT chk_retry_count CHECK (retry_count >= 0 AND retry_count < max_attempts)
);

-- ============================================
-- TABLE: notification_audit
-- ============================================
CREATE TABLE IF NOT EXISTS notification_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'read', 'updated', 'deleted', 'delivered', 'failed', 'action', 'preference_updated')),
    action_at TIMESTAMP NOT NULL DEFAULT NOW(),
    action_by VARCHAR(255),
    action_details JSONB,
    ip_address INET,
    user_agent TEXT,
    device VARCHAR(100),
    location VARCHAR(255),
    previous_hash VARCHAR(64),
    current_hash VARCHAR(64),
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_audit_notification FOREIGN KEY (notification_id) REFERENCES notifications(notification_id) ON DELETE CASCADE
);

-- ============================================
-- TABLE: notification_templates
-- ============================================
CREATE TABLE IF NOT EXISTS notification_templates (
    template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    event_type VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    body_template TEXT,
    variables JSONB,
    channels JSONB,
    channel_templates JSONB,
    actions JSONB,
    language VARCHAR(10) DEFAULT 'fr',
    translations JSONB,
    active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_event_language UNIQUE (tenant_id, event_type, language)
);

-- ============================================
-- TABLE: notification_policies
-- ============================================
CREATE TABLE IF NOT EXISTS notification_policies (
    policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL CHECK (type IN ('role', 'preference', 'antispam', 'business', 'delivery')),
    priority INTEGER NOT NULL DEFAULT 50 CHECK (priority >= 1 AND priority <= 100),
    enabled BOOLEAN DEFAULT TRUE,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    transformations JSONB,
    roles JSONB,
    categories JSONB,
    priorities JSONB,
    event_types JSONB,
    "order" INTEGER NOT NULL DEFAULT 0,
    stop_on_match BOOLEAN DEFAULT FALSE,
    version VARCHAR(20) DEFAULT '1.0',
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_user ON notifications(tenant_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(tenant_id, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(tenant_id, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(tenant_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_created ON notifications(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(tenant_id, user_id, created_at DESC) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_covering ON notifications(tenant_id, user_id, created_at DESC) INCLUDE (title, message, priority, category, read);

-- Recipients indexes
CREATE INDEX IF NOT EXISTS idx_recipients_notification ON notification_recipients(notification_id);
CREATE INDEX IF NOT EXISTS idx_recipients_user ON notification_recipients(user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_recipients_status ON notification_recipients(status);

-- Preferences indexes
CREATE INDEX IF NOT EXISTS idx_preferences_user ON notification_preferences(user_id, tenant_id);

-- Deliveries indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_notification ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_next_retry ON notification_deliveries(next_retry_at) WHERE status = 'retrying';

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_notification ON notification_audit(notification_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_user ON notification_audit(tenant_id, user_id, action_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON notification_audit(action, action_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON notification_audit(created_at DESC);

-- Templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_event_type ON notification_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_templates_tenant ON notification_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_templates_active ON notification_templates(active) WHERE active = TRUE;

-- Policies indexes
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON notification_policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_type ON notification_policies(type);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON notification_policies(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_policies_order ON notification_policies("order");

-- ============================================
-- TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON notifications
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_recipients_updated_at BEFORE UPDATE ON notification_recipients
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_preferences_updated_at BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_deliveries_updated_at BEFORE UPDATE ON notification_deliveries
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_templates_updated_at BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trigger_policies_updated_at BEFORE UPDATE ON notification_policies
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get unread count for user
CREATE OR REPLACE FUNCTION get_unread_count(p_tenant_id UUID, p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM notifications
        WHERE tenant_id = p_tenant_id
          AND user_id = p_user_id
          AND read = FALSE
          AND deleted_at IS NULL
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_as_read(p_notification_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read = TRUE,
        read_at = NOW(),
        updated_at = NOW()
    WHERE notification_id = p_notification_id
      AND user_id = p_user_id
      AND read = FALSE;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Archive old notifications
CREATE OR REPLACE FUNCTION archive_old_notifications(p_tenant_id UUID, p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE notifications
    SET archived = TRUE,
        archived_at = NOW(),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND archived = FALSE
      AND created_at < NOW() - INTERVAL '1 day' * p_days
      AND deleted_at IS NULL;
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Delete expired notifications
CREATE OR REPLACE FUNCTION delete_expired_notifications(p_tenant_id UUID, p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications
    WHERE tenant_id = p_tenant_id
      AND (expires_at IS NOT NULL AND expires_at < NOW())
      OR (archived = TRUE AND archived_at < NOW() - INTERVAL '1 day' * p_days);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE notifications IS 'Core notifications table - stores all notification data';
COMMENT ON TABLE notification_recipients IS 'Notification recipients - links notifications to users';
COMMENT ON TABLE notification_preferences IS 'User notification preferences';
COMMENT ON TABLE notification_deliveries IS 'Notification delivery attempts';
COMMENT ON TABLE notification_audit IS 'Audit trail for all notification actions';
COMMENT ON TABLE notification_templates IS 'Notification templates for different event types';
COMMENT ON TABLE notification_policies IS 'Notification policies for routing and filtering';

COMMENT ON COLUMN notifications.payload IS 'Additional data for the notification (JSON)';
COMMENT ON COLUMN notifications.metadata IS 'System metadata (JSON)';
COMMENT ON COLUMN notifications.sensitivity IS 'Data sensitivity level for security';
COMMENT ON COLUMN notifications.encrypted IS 'Whether the notification is encrypted';

-- ============================================
-- GRANTS (adjust as needed)
-- ============================================

-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ekala_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ekala_app;

-- ============================================
-- END OF MIGRATION
-- ============================================