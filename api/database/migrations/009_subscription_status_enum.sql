-- Migration: Convert Subscriptions.status to ENUM
-- Purpose: Enforce valid status values at the database level to prevent invalid states
--          (e.g. "suspend" instead of "suspended", "cancel" instead of "cancelled")

-- Step 1: Fix any existing rows with legacy invalid status values
UPDATE Subscriptions SET status = 'suspended' WHERE status = 'suspend';
UPDATE Subscriptions SET status = 'cancelled' WHERE status = 'cancel';

-- Step 2: Convert the column from VARCHAR to ENUM
ALTER TABLE Subscriptions
  MODIFY COLUMN status ENUM(
    'active',
    'suspended',
    'cancelled',
    'disabled',
    'trial',
    'paused',
    'inactive',
    'expired'
  ) NULL DEFAULT NULL;
