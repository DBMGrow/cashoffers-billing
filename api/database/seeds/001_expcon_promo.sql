-- Seed: EXPCON, first month of Express Offers Pro free for agents who sign up at eXpCon 2026.
-- Requires migration 014_promo_codes.sql. Hand-run, like the migrations. Safe to re-run: the
-- unique key on `code` makes a second run update the row instead of inserting another.
-- ROLLBACK: UPDATE PromoCodes SET active = 0 WHERE code = 'EXPCON';  (deactivate; deleting would orphan redemptions)
--
-- Scope: the ExpressOffers white label (Products.whitelabel_code = 'EXP') and any product whose
-- data.cashoffers.user_config.role_v2 is AGENT_EXP_PRO. That finds the Pro product in every
-- environment without knowing its product_id (staging uses 70; production is not confirmed).
--
-- PLACEHOLDERS, confirm before running on production:
--   1. ends_at: set to the real campaign end. The value below is a placeholder.
--   2. product_ids: optional. To pin the code to one product as well as the role, replace NULL with
--      JSON_ARRAY(<production Pro product_id>). Look it up with:
--        SELECT product_id, product_name, whitelabel_code,
--               JSON_UNQUOTE(JSON_EXTRACT(data, '$.cashoffers.user_config.role_v2')) AS role_v2
--        FROM Products WHERE whitelabel_code = 'EXP';
--   3. applies_to: 'first_charge' makes today's charge $0 in both flows. Pro has no signup fee
--      (data.signup_fee = 0, set 2026-09-28), so this equals 'first_period' today; it is kept because
--      a product created without data.signup_fee falls back to Products.price as a signup fee, and
--      'first_charge' still waives that. An existing Guest upgrading through /manage pays $0 either way.
--   4. max_redemptions: NULL (unlimited). Set a number to cap the campaign.

INSERT INTO PromoCodes (
  code, description, whitelabel_code, product_ids, product_roles,
  discount_type, discount_value, applies_to, duration_periods,
  max_redemptions, max_per_user, starts_at, ends_at, active, new_users_only,
  campaign, external_coupon_id, created_by
) VALUES (
  'EXPCON',
  'eXpCon 2026: first month of Express Offers Pro free',
  'EXP',
  NULL,                              -- PLACEHOLDER: JSON_ARRAY(<production Pro product_id>) to pin it
  JSON_ARRAY('AGENT_EXP_PRO'),
  'free_periods', 1, 'first_charge', 1,
  NULL, 1,
  NULL,                              -- valid from now
  '2026-11-30 23:59:59',             -- PLACEHOLDER: real campaign end (server time, UTC)
  1, 1,
  'eXpCon 2026',
  NULL,
  'seed 001_expcon_promo.sql'
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  whitelabel_code = VALUES(whitelabel_code),
  product_ids = VALUES(product_ids),
  product_roles = VALUES(product_roles),
  discount_type = VALUES(discount_type),
  discount_value = VALUES(discount_value),
  applies_to = VALUES(applies_to),
  duration_periods = VALUES(duration_periods),
  max_redemptions = VALUES(max_redemptions),
  max_per_user = VALUES(max_per_user),
  starts_at = VALUES(starts_at),
  ends_at = VALUES(ends_at),
  active = VALUES(active),
  new_users_only = VALUES(new_users_only),
  campaign = VALUES(campaign);

-- Check it matches the Pro product (expect one row per EXP Pro product):
-- SELECT pc.code, p.product_id, p.product_name
-- FROM PromoCodes pc
-- JOIN Products p ON p.whitelabel_code = pc.whitelabel_code
--   AND JSON_CONTAINS(pc.product_roles, JSON_QUOTE(JSON_UNQUOTE(JSON_EXTRACT(p.data, '$.cashoffers.user_config.role_v2'))))
-- WHERE pc.code = 'EXPCON';
