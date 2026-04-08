-- Migration: Create PurchaseRequests Table
-- Purpose: Track all purchase attempts with granular status tracking for audit trail and event-based architecture
-- Phase: 1 of 4 (PurchaseRequest Tracking)

CREATE TABLE IF NOT EXISTS PurchaseRequests (
  -- Primary identification
  request_id INT AUTO_INCREMENT PRIMARY KEY,
  request_uuid VARCHAR(36) UNIQUE NOT NULL,

  -- Request classification
  request_type ENUM('NEW_PURCHASE', 'RENEWAL', 'UPGRADE') NOT NULL,
  source ENUM('API', 'CRON', 'ADMIN') DEFAULT 'API',

  -- Core identifiers
  user_id INT NULL,
  email VARCHAR(255) NOT NULL,
  product_id INT NOT NULL,
  subscription_id INT NULL,

  -- Input data (for auditability and retry)
  request_data JSON NOT NULL,

  -- Status tracking
  status ENUM(
    'PENDING',
    'VALIDATING',
    'PROCESSING_PAYMENT',
    'CREATING_SUBSCRIPTION',
    'FINALIZING',
    'COMPLETED',
    'FAILED',
    'RETRY_SCHEDULED'
  ) DEFAULT 'PENDING',

  -- Error tracking
  failure_reason TEXT NULL,
  error_code VARCHAR(50) NULL,
  retry_count INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at DATETIME NULL,

  -- Results (set on completion)
  subscription_id_result INT NULL,
  transaction_id_result INT NULL,
  amount_charged INT NULL,
  card_id_result VARCHAR(100) NULL,

  -- Metadata
  idempotency_key VARCHAR(100) NULL,
  user_created BOOLEAN DEFAULT FALSE,
  prorated_amount INT NULL,

  -- Audit timestamps
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  processing_duration_ms INT NULL,

  -- Indexes for performance
  INDEX idx_user_email (user_id, email),
  INDEX idx_status_retry (status, next_retry_at),
  INDEX idx_request_uuid (request_uuid),
  INDEX idx_subscription_result (subscription_id_result),
  INDEX idx_createdAt (createdAt),

  -- Foreign keys
  FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT,
  FOREIGN KEY (subscription_id) REFERENCES Subscriptions(subscription_id) ON DELETE SET NULL,
  FOREIGN KEY (subscription_id_result) REFERENCES Subscriptions(subscription_id) ON DELETE SET NULL,
  FOREIGN KEY (transaction_id_result) REFERENCES Transactions(transaction_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add comment for documentation
ALTER TABLE PurchaseRequests COMMENT = 'Tracks all purchase attempts with status transitions for audit trail and event-based processing';
