-- Migration: Add product_category to Products
-- Purpose: Explicit product category for filtering without JSON parsing.
--          Three categories: premium_cashoffers (billing manages CO + HU bundle),
--          external_cashoffers (CO managed externally, HU overages only),
--          homeuptick_only (SHELL CO access + HU, base monthly fee).

ALTER TABLE Products
  ADD COLUMN product_category ENUM(
    'premium_cashoffers',
    'external_cashoffers',
    'homeuptick_only'
  ) NOT NULL DEFAULT 'premium_cashoffers'
  AFTER product_type;

-- Backfill: all existing products are premium_cashoffers (the default).
-- New external_cashoffers and homeuptick_only products will be inserted
-- with the correct category explicitly set.
