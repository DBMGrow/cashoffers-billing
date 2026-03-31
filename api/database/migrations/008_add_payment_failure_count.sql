-- Migration 008: Add payment_failure_count to Subscriptions
--
-- Purpose: Track the number of consecutive payment failures on a subscription
-- using an explicit counter rather than inferring attempt number from elapsed time.
-- This fixes a bug where fast-forwarding next_renewal_attempt to a past date caused
-- the time-based heuristic to skip straight to auto-suspend on the 2nd failure.
--
-- The counter is incremented on each failure and reset to 0 on successful renewal.
-- Retry schedule:
--   count = 0 (1st failure)  → retry in 1 day
--   count = 1 (2nd failure)  → retry in 3 days
--   count = 2 (3rd failure)  → retry in 7 days
--   count >= 3 (4th failure) → auto-suspend

ALTER TABLE Subscriptions
  ADD COLUMN payment_failure_count INT NOT NULL DEFAULT 0
    COMMENT 'Number of consecutive payment failures; reset to 0 on successful renewal';
