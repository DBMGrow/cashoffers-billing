-- Migration: Promo codes and their redemptions
-- Purpose: Let a white label run a discount campaign (first launch: eXp "EXPCON", first month of
--          Express Offers Pro free for agents who sign up at eXpCon 2026) and report on who used it.
--          Additive only. Nothing reads these tables until a purchase carries a `coupon`.
--          See docs/business/capabilities/promo-codes.md.
-- ROLLBACK: DROP TABLE IF EXISTS PromoRedemptions; DROP TABLE IF EXISTS PromoCodes;

CREATE TABLE IF NOT EXISTS PromoCodes (
  promo_id INT AUTO_INCREMENT PRIMARY KEY,

  -- Stored uppercase; purchases and the validate endpoint uppercase the input before matching.
  code VARCHAR(64) NOT NULL,
  description VARCHAR(255) NULL,

  -- Scope. NULL means "any".
  whitelabel_code VARCHAR(32) NULL COMMENT 'Products.whitelabel_code this code is valid for, NULL = all',
  product_ids JSON NULL COMMENT 'Array of Products.product_id, NULL = all',
  product_roles JSON NULL COMMENT 'Array of role_v2 values the product must sell, NULL = all',

  -- The discount.
  discount_type ENUM('free_periods', 'percent', 'amount') NOT NULL,
  discount_value INT NOT NULL COMMENT 'free_periods: periods; percent: 1-100; amount: cents',
  applies_to ENUM('first_period', 'first_charge') NOT NULL DEFAULT 'first_period'
    COMMENT 'first_period: discount only the first billing period (signup fee still charged); first_charge: the whole initial charge',
  duration_periods INT NOT NULL DEFAULT 1
    COMMENT 'Billing periods the discount covers. Only the first charge is discounted today; the rest is recorded on the redemption for a later renewal phase',

  -- Limits.
  max_redemptions INT NULL COMMENT 'Total redemptions across everyone, NULL = unlimited',
  max_per_user INT NOT NULL DEFAULT 1,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  new_users_only TINYINT(1) NOT NULL DEFAULT 0
    COMMENT 'Refuse a buyer who already has (or had) a paid subscription',

  -- Reporting and future mapping.
  campaign VARCHAR(128) NULL COMMENT 'Grouping for reports, e.g. "eXpCon 2026"',
  external_coupon_id VARCHAR(128) NULL COMMENT 'Matching coupon in another processor (future Stripe mapping)',
  created_by VARCHAR(255) NULL,

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_promo_code (code),
  INDEX idx_promo_campaign (campaign),
  INDEX idx_promo_whitelabel (whitelabel_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PromoRedemptions (
  redemption_id INT AUTO_INCREMENT PRIMARY KEY,
  promo_id INT NOT NULL,
  code VARCHAR(64) NOT NULL COMMENT 'Denormalised for reports',

  -- Who. user_id is NULL until a new signup is provisioned.
  user_id INT NULL,
  email VARCHAR(255) NOT NULL COMMENT 'Lowercased',

  -- What. subscription_id is NULL between the reservation (before the charge) and the subscription row.
  subscription_id INT NULL,
  purchase_request_id INT NOT NULL,
  product_id INT NOT NULL,
  whitelabel_code VARCHAR(32) NULL,

  -- Money, in cents.
  original_amount INT NOT NULL COMMENT 'Initial charge before the discount',
  discount_amount INT NOT NULL,
  charged_amount INT NOT NULL,

  periods_total INT NOT NULL DEFAULT 1,
  periods_remaining INT NOT NULL DEFAULT 0 COMMENT 'Discounted periods still owed after the first charge',
  status ENUM('applied', 'exhausted', 'voided') NOT NULL DEFAULT 'applied'
    COMMENT 'voided: the purchase failed before anything was charged or created; not counted against limits',

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  -- A purchase request redeems at most once, however often its code path runs.
  UNIQUE KEY uq_redemption_purchase_request (purchase_request_id),
  INDEX idx_redemption_promo_status (promo_id, status),
  INDEX idx_redemption_email (email),
  INDEX idx_redemption_user (user_id),
  INDEX idx_redemption_subscription (subscription_id),
  CONSTRAINT fk_redemption_promo FOREIGN KEY (promo_id) REFERENCES PromoCodes (promo_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
