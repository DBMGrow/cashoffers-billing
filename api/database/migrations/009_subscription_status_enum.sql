-- Migration: Normalize Subscriptions.status values
-- Purpose: Fix legacy rows that used shorthand status values (e.g. "suspend" instead of "suspended").
--          The column is intentionally kept as VARCHAR (not converted to ENUM) so that old code
--          can still write to it during a cutover/rollback window. ENUM enforcement can be applied
--          in a later migration once the old system is fully decommissioned.

-- Normalize any existing rows with legacy shorthand status values
UPDATE Subscriptions SET status = 'suspended' WHERE status = 'suspend';
UPDATE Subscriptions SET status = 'cancelled' WHERE status = 'cancel';
UPDATE Subscriptions SET status = 'paused' WHERE status = 'pause';
UPDATE Subscriptions SET status = 'active' WHERE status = 'downgrade';
