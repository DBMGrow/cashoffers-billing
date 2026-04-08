-- Migration: Create BillingLogs table for production log persistence
-- Purpose: Store all application logs in database for monitoring, debugging, and audit trails

CREATE TABLE IF NOT EXISTS BillingLogs (
  log_id BIGINT AUTO_INCREMENT PRIMARY KEY,

  -- Log classification
  level ENUM('debug', 'info', 'warn', 'error') NOT NULL,
  message TEXT NOT NULL,

  -- Request context (nullable - not all logs are from requests)
  request_id VARCHAR(36) NULL,
  user_id INT NULL,

  -- Component identification
  component VARCHAR(100) NULL COMMENT 'Logger context component name',
  service VARCHAR(50) DEFAULT 'cashoffers-billing',

  -- Context type for filtering
  context_type ENUM('http_request', 'cron_job', 'event_handler', 'background') NOT NULL,

  -- Flexible metadata storage
  metadata JSON NULL COMMENT 'Structured metadata from log entry',
  error_stack TEXT NULL COMMENT 'Stack trace for error logs',

  -- Timestamps
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Performance indexes
  INDEX idx_level_created (level, createdAt),
  INDEX idx_request_id (request_id),
  INDEX idx_user_id (user_id),
  INDEX idx_context_type (context_type),
  INDEX idx_component (component),
  INDEX idx_created (createdAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
