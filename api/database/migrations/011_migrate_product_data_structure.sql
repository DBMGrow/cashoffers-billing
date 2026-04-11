-- Migration: Set all Products to their definitive configuration
--
-- This replaces the previous data-only restructure with a full authoritative update of every column.
-- Uses INSERT ... ON DUPLICATE KEY UPDATE so it works whether the row exists or not.
-- Product 12 (Property Unlock) is a one-time product with NULL data.
-- Products 51-55 may be new rows depending on environment.
--
-- **Old code cannot read the new data JSON format after this runs.**

-- ============================================================================
-- premium_cashoffers: kwofferings
-- ============================================================================

-- Product 1: Individual (kwofferings, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (1, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'kwofferings', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2023-11-15 23:43:41', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 2: Small Team (kwofferings, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (2, 'Small Team', 'Owner plus up to 5 users', 'subscription', 'premium_cashoffers', 'kwofferings', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 3: Medium Team (kwofferings, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (3, 'Medium Team', 'Owner plus up to 10 users', 'subscription', 'premium_cashoffers', 'kwofferings', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 4: Large Team (kwofferings, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (4, 'Large Team', 'Owner plus up to 15 users', 'subscription', 'premium_cashoffers', 'kwofferings', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 5: Custom Team 20 (kwofferings, 20 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (5, 'Custom Team (20)', '20 users', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 20}}, "renewal_cost": 200000}',
  '2023-11-30 11:25:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 6: Custom Team 50 (kwofferings, 50 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (6, 'Custom Team (50)', '50 users', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 50}}, "renewal_cost": 175000}',
  '2023-11-30 11:25:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 7: Custom Team 75 (kwofferings, 75 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (7, 'Custom Team (75)', '75 users', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 75}}, "renewal_cost": 150000}',
  '2023-11-30 11:25:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 8: Custom Team 100 (kwofferings, 100 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (8, 'Custom Team (100)', '100 users', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 100}}, "renewal_cost": 25000}',
  '2023-11-30 11:25:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 9: Custom Team 200 (kwofferings, 200 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (9, 'Custom Team (200)', '200 users', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 200}}, "renewal_cost": 1500000}',
  '2023-11-30 11:25:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 46: Investor (kwofferings)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (46, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'kwofferings', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-03-24 17:29:10')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 51: Free Agent (kwofferings)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (51, 'Free Agent', 'Free agent account', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 0, "is_team_plan": false}}, "signup_fee": 0, "renewal_cost": 0}',
  '2026-03-24 18:00:42', '2026-03-24 18:00:42')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 52: Free Investor (kwofferings)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (52, 'Free Investor', 'Free investor account', 'subscription', 'premium_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 0, "is_team_plan": false}}, "signup_fee": 0, "renewal_cost": 0}',
  '2026-03-24 18:04:22', '2026-03-24 18:04:22')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: default
-- ============================================================================

-- Product 11: Investor (default)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (11, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'default', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 61: Individual (default, AGENT) — was product_id 42 on staging, reassigned due to ehsa collision
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (61, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'default', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2023-11-15 23:43:41', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 43: Small Team (default, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (43, 'Small Team', 'Owner plus up to 5 users', 'subscription', 'premium_cashoffers', 'default', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 44: Medium Team (default, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (44, 'Medium Team', 'Owner plus up to 10 users', 'subscription', 'premium_cashoffers', 'default', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 45: Large Team (default, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (45, 'Large Team', 'Owner plus up to 15 users', 'subscription', 'premium_cashoffers', 'default', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:10')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: yhsgr
-- ============================================================================

-- Product 13: Individual (yhsgr, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (13, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2023-11-15 23:43:41', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 14: Small Team (yhsgr, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (14, 'Small Team', 'up to 5 users', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 15: Medium Team (yhsgr, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (15, 'Medium Team', 'up to 10 users', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 16: Large Team (yhsgr, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (16, 'Large Team', 'up to 15 users', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 17: Mini Team (yhsgr, 3 members, price=0)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (17, 'Mini Team', 'up to 3 users', 'subscription', 'premium_cashoffers', 'yhsgr', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 50000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 18: Mini Team (yhsgr, 3 members, price=25000)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (18, 'Mini Team', 'up to 3 users', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 50000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 47: Investor (yhsgr)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (47, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'yhsgr', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-03-24 17:29:10')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: uco
-- ============================================================================

-- Product 21: Individual (uco, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (21, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'uco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 29900}',
  '2023-11-15 23:43:41', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 22: 3 Agents (uco, 3 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (22, '3 Agents', 'up to 3 users', 'subscription', 'premium_cashoffers', 'uco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 59900}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 23: 6 Agents (uco, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (23, '6 Agents', 'up to 6 users', 'subscription', 'premium_cashoffers', 'uco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 94900}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 24: 11 Agents (uco, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (24, '11 Agents', 'up to 11 users', 'subscription', 'premium_cashoffers', 'uco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 149900}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 25: 16 Agents (uco, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (25, '16 Agents', 'up to 16 users', 'subscription', 'premium_cashoffers', 'uco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 199900}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 49: Investor (uco)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (49, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'uco', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-03-24 17:29:10')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: mop
-- ============================================================================

-- Product 26: Individual (mop, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (26, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'mop', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2023-11-15 23:43:41', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 27: 3 Agents (mop, 3 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (27, '3 Agents', 'up to 3 users', 'subscription', 'premium_cashoffers', 'mop', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 50000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 28: 6 Agents (mop, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (28, '6 Agents', 'up to 6 users', 'subscription', 'premium_cashoffers', 'mop', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:08')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 29: 11 Agents (mop, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (29, '11 Agents', 'up to 11 users', 'subscription', 'premium_cashoffers', 'mop', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 30: 16 Agents (mop, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (30, '16 Agents', 'up to 16 users', 'subscription', 'premium_cashoffers', 'mop', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2023-11-17 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 50: Investor (mop)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (50, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'mop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-03-24 17:29:10')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: eco
-- ============================================================================

-- Product 33: Individual (eco, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (33, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'eco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2026-01-20 23:43:41', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 34: 3 Agents (eco, 3 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (34, '3 Agents', 'up to 3 users', 'subscription', 'premium_cashoffers', 'eco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 50000}',
  '2026-01-20 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 35: 6 Agents (eco, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (35, '6 Agents', 'up to 6 users', 'subscription', 'premium_cashoffers', 'eco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2026-01-20 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 36: 11 Agents (eco, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (36, '11 Agents', 'up to 11 users', 'subscription', 'premium_cashoffers', 'eco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2026-01-20 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 37: 16 Agents (eco, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (37, '16 Agents', 'up to 16 users', 'subscription', 'premium_cashoffers', 'eco', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2026-01-20 05:13:14', '2026-03-24 17:29:09')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: ehsa (occupies IDs 38-42 in production)
-- ============================================================================

-- Product 38: Individual (ehsa, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (38, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'ehsa', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 29900}',
  '2026-01-20 23:43:41', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 39: 3 Agents (ehsa, 3 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (39, '3 Agents', 'up to 3 users', 'subscription', 'premium_cashoffers', 'ehsa', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}, "renewal_cost": 59900}',
  '2026-01-20 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 40: 6 Agents (ehsa, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (40, '6 Agents', 'up to 6 users', 'subscription', 'premium_cashoffers', 'ehsa', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 94900}',
  '2026-01-20 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 41: 11 Agents (ehsa, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (41, '11 Agents', 'up to 11 users', 'subscription', 'premium_cashoffers', 'ehsa', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 149900}',
  '2026-01-20 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 42: 16 Agents (ehsa, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (42, '16 Agents', 'up to 16 users', 'subscription', 'premium_cashoffers', 'ehsa', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 199900}',
  '2026-01-20 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- premium_cashoffers: iop (new IDs — production 38-42 taken by ehsa)
-- ============================================================================

-- Product 56: Individual (iop, AGENT)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (56, 'Individual', 'Individual', 'subscription', 'premium_cashoffers', 'iop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 25000}',
  '2023-11-15 23:43:41', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 57: Small Team (iop, 6 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (57, 'Small Team', 'Owner plus up to 5 users', 'subscription', 'premium_cashoffers', 'iop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}, "renewal_cost": 85000}',
  '2023-11-17 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 58: Medium Team (iop, 11 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (58, 'Medium Team', 'Owner plus up to 10 users', 'subscription', 'premium_cashoffers', 'iop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}, "renewal_cost": 137500}',
  '2023-11-17 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 59: Large Team (iop, 16 members)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (59, 'Large Team', 'Owner plus up to 15 users', 'subscription', 'premium_cashoffers', 'iop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}, "renewal_cost": 175000}',
  '2023-11-17 05:13:14', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 60: Investor (iop)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (60, 'Investor', 'Individual', 'subscription', 'premium_cashoffers', 'iop', 25000,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}, "renewal_cost": 9900}',
  '2024-06-19 00:00:00', '2026-04-11 00:00:00')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- One-time product (no data)
-- ============================================================================

-- Product 12: Property Unlock
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (12, 'Property Unlock', NULL, 'one-time', 'premium_cashoffers', NULL, 5000, NULL,
  '2025-04-03 16:33:35', '2026-03-24 17:29:07')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- external_cashoffers: HomeUptick Access (addon for existing CO users)
-- ============================================================================

-- Product 53: HomeUptick Access (kwofferings)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (53, 'HomeUptick Access', 'HomeUptick access for users that already have a premium CashOffers Account', 'subscription', 'external_cashoffers', 'kwofferings', 0,
  '{"duration": "monthly", "cashoffers": {"managed": false}, "homeuptick": {"enabled": true, "base_contacts": 50}, "signup_fee": 0, "renewal_cost": 0}',
  '2026-04-01 17:35:02', '2026-04-01 17:35:02')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- Product 55: HomeUptick Access (default)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (55, 'HomeUptick Access', 'HomeUptick access for users that already have a premium CashOffers Account', 'subscription', 'external_cashoffers', 'default', 0,
  '{"duration": "monthly", "cashoffers": {"managed": false}, "homeuptick": {"enabled": true, "base_contacts": 50}, "signup_fee": 0, "renewal_cost": 0}',
  '2026-04-01 17:35:02', '2026-04-01 17:35:02')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);

-- ============================================================================
-- homeuptick_only: Standalone HomeUptick
-- ============================================================================

-- Product 54: HomeUptick (standalone, free trial)
INSERT INTO Products (product_id, product_name, product_description, product_type, product_category, whitelabel_code, price, data, createdAt, updatedAt)
VALUES (54, 'HomeUptick', 'Standalone HomeUptick access with a free trial — converts to paid at end of trial period', 'subscription', 'homeuptick_only', 'homeuptick', 0,
  '{"duration": "monthly", "cashoffers": {"managed": true, "user_config": {"role": "HOMEUPTICK", "is_premium": 1}}, "homeuptick": {"enabled": true, "free_trial": {"enabled": true, "contacts": 25, "duration_days": 14}, "base_contacts": 25}, "signup_fee": 0, "renewal_cost": 2000}',
  '2026-04-01 17:36:41', '2026-04-01 17:36:41')
ON DUPLICATE KEY UPDATE
  product_name = VALUES(product_name), product_description = VALUES(product_description),
  product_type = VALUES(product_type), product_category = VALUES(product_category),
  whitelabel_code = VALUES(whitelabel_code), price = VALUES(price), data = VALUES(data), updatedAt = VALUES(updatedAt);
