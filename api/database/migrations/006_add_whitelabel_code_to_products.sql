-- Migration: Add whitelabel_code column to Products table
-- Stores the whitelabel code directly on the product row for efficient filtering,
-- replacing the previous approach of reading from the nested data->user_config->whitelabel_id JSON field.

ALTER TABLE Products
ADD COLUMN whitelabel_code VARCHAR(50) NULL AFTER product_type;

-- Backfill whitelabel_code for existing products that have a whitelabel_id in their JSON data
UPDATE Products p
INNER JOIN Whitelabels w
  ON w.whitelabel_id = CAST(JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.user_config.whitelabel_id')) AS UNSIGNED)
SET p.whitelabel_code = w.code
WHERE JSON_EXTRACT(p.data, '$.user_config.whitelabel_id') IS NOT NULL;
