-- Migration: Add whitelabel-specific suspension behavior configuration
-- This allows different white labels to define how user accounts should be handled
-- when their subscription is suspended:
--   - DOWNGRADE_TO_FREE: Sets is_premium = 0 (user remains active with limited access)
--   - DEACTIVATE_USER: Sets active = 0 (user account is fully deactivated)

-- Add suspension_behavior field to Whitelabels table
ALTER TABLE Whitelabels
ADD COLUMN suspension_behavior ENUM('DOWNGRADE_TO_FREE', 'DEACTIVATE_USER')
NOT NULL
DEFAULT 'DOWNGRADE_TO_FREE'
AFTER name;

-- Add index for query performance when looking up suspension behavior
CREATE INDEX idx_whitelabels_suspension_behavior ON Whitelabels(suspension_behavior);

-- Backfill existing whitelabels with default behavior (downgrade to free)
UPDATE Whitelabels
SET suspension_behavior = 'DOWNGRADE_TO_FREE'
WHERE suspension_behavior IS NULL;
