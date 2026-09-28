-- Report: promo code redemptions, by campaign and white label.
-- Read-only. See docs/business/capabilities/promo-codes.md for how to run it.
--
-- One row per redemption that was not voided. Filter by setting the variables (NULL = all):
SET @campaign = 'eXpCon 2026';
SET @whitelabel = NULL; -- e.g. 'EXP'
SET @code = NULL;       -- e.g. 'EXPCON'

SELECT
  pc.campaign,
  pr.code,
  pr.whitelabel_code,
  pr.createdAt                                  AS redeemed_at,
  pr.email,
  u.name                                        AS name,
  pr.user_id,
  pr.subscription_id,
  s.createdAt                                   AS signup_date,
  p.product_name                                AS product,
  pr.original_amount / 100                      AS original_usd,
  pr.discount_amount / 100                      AS discount_usd,
  pr.charged_amount / 100                       AS charged_today_usd,
  s.amount / 100                                AS renews_at_usd,
  s.status                                      AS subscription_status,
  s.renewal_date                                AS next_renewal,
  first_paid.first_paid_renewal_at,
  first_paid.first_paid_renewal_at IS NOT NULL  AS first_paid_renewal_happened,
  first_paid.first_paid_renewal_amount / 100    AS first_paid_renewal_usd,
  pr.status                                     AS redemption_status,
  pr.purchase_request_id
FROM PromoRedemptions pr
JOIN PromoCodes pc ON pc.promo_id = pr.promo_id
LEFT JOIN Subscriptions s ON s.subscription_id = pr.subscription_id
LEFT JOIN Users u ON u.user_id = pr.user_id
LEFT JOIN Products p ON p.product_id = pr.product_id
-- The first renewal that actually charged something: renewals are tracked as RENEWAL purchase requests.
LEFT JOIN (
  SELECT
    r.subscription_id,
    MIN(r.completed_at) AS first_paid_renewal_at,
    SUBSTRING_INDEX(GROUP_CONCAT(r.amount_charged ORDER BY r.completed_at), ',', 1) AS first_paid_renewal_amount
  FROM PurchaseRequests r
  WHERE r.request_type = 'RENEWAL'
    AND r.status = 'COMPLETED'
    AND r.amount_charged > 0
  GROUP BY r.subscription_id
) first_paid ON first_paid.subscription_id = pr.subscription_id
WHERE pr.status <> 'voided'
  AND (@campaign IS NULL OR pc.campaign = @campaign)
  AND (@whitelabel IS NULL OR pr.whitelabel_code = @whitelabel)
  AND (@code IS NULL OR pr.code = @code)
ORDER BY pc.campaign, pr.createdAt;

-- Totals per campaign and white label:
SELECT
  pc.campaign,
  pr.whitelabel_code,
  pr.code,
  COUNT(*)                                  AS redemptions,
  SUM(pr.discount_amount) / 100             AS total_discount_usd,
  SUM(s.status = 'active')                  AS still_active,
  SUM(fp.subscription_id IS NOT NULL)       AS converted_to_paid
FROM PromoRedemptions pr
JOIN PromoCodes pc ON pc.promo_id = pr.promo_id
LEFT JOIN Subscriptions s ON s.subscription_id = pr.subscription_id
LEFT JOIN (
  SELECT DISTINCT subscription_id
  FROM PurchaseRequests
  WHERE request_type = 'RENEWAL' AND status = 'COMPLETED' AND amount_charged > 0
) fp ON fp.subscription_id = pr.subscription_id
WHERE pr.status <> 'voided'
  AND (@campaign IS NULL OR pc.campaign = @campaign)
  AND (@whitelabel IS NULL OR pr.whitelabel_code = @whitelabel)
  AND (@code IS NULL OR pr.code = @code)
GROUP BY pc.campaign, pr.whitelabel_code, pr.code
ORDER BY pc.campaign, pr.whitelabel_code, pr.code;
