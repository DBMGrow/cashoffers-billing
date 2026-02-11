-- Migration: Add Square environment tracking to support dual production/sandbox environments
-- This allows the system to track which Square environment (production or sandbox) was used
-- for each transaction, card, and subscription to ensure consistent renewal behavior

-- Add environment tracking to Transactions
ALTER TABLE Transactions
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER square_transaction_id;

-- Add environment tracking to UserCards
ALTER TABLE UserCards
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER square_customer_id;

-- Add environment tracking to Subscriptions
ALTER TABLE Subscriptions
ADD COLUMN square_environment ENUM('production', 'sandbox')
DEFAULT 'production'
AFTER product_id;

-- Add indexes for environment filtering (improves query performance)
CREATE INDEX idx_transactions_environment ON Transactions(square_environment);
CREATE INDEX idx_user_cards_environment ON UserCards(square_environment);
CREATE INDEX idx_subscriptions_environment ON Subscriptions(square_environment);

-- Backfill existing records to production (all existing data is from production environment)
UPDATE Transactions SET square_environment = 'production' WHERE square_environment IS NULL;
UPDATE UserCards SET square_environment = 'production' WHERE square_environment IS NULL;
UPDATE Subscriptions SET square_environment = 'production' WHERE square_environment IS NULL;
