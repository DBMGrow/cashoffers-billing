-- Migration 007: Make Subscriptions.user_id nullable and add provisioning_status
--
-- Purpose: Decouple user creation from the payment/subscription transaction.
-- After this migration, a subscription can be created before a user exists.
-- provisioning_status tracks whether the user account has been successfully
-- created and bound to the subscription.
--
-- provisioning_status values:
--   NULL               = subscription created with user already known (existing user
--                        purchases, legacy data) — no provisioning step required
--   'provisioned'      = user was created and bound after subscription was created
--   'pending_provisioning' = user creation failed; subscription exists but user does not;
--                            requires manual intervention

ALTER TABLE Subscriptions
  MODIFY COLUMN user_id INT NULL;

ALTER TABLE Subscriptions
  ADD COLUMN provisioning_status ENUM('provisioned', 'pending_provisioning') NULL DEFAULT NULL
    COMMENT 'NULL = no deferred provisioning needed; pending_provisioning = user creation failed and needs retry';

ALTER TABLE Subscriptions
  ADD INDEX idx_provisioning_status (provisioning_status);
