-- Migrate homeuptick_only products from role=SHELL to role=HOMEUPTICK in their JSON data.
-- SHELL is now reserved for deactivated users; HOMEUPTICK designates active HU-only access.

UPDATE Products
SET data = JSON_SET(
  data,
  '$.cashoffers.user_config.role', 'HOMEUPTICK'
)
WHERE product_category = 'homeuptick_only'
  AND JSON_EXTRACT(data, '$.cashoffers.user_config.role') = 'SHELL';

-- Also update legacy root-level user_config if present
UPDATE Products
SET data = JSON_SET(
  data,
  '$.user_config.role', 'HOMEUPTICK'
)
WHERE product_category = 'homeuptick_only'
  AND JSON_EXTRACT(data, '$.user_config.role') = 'SHELL';
