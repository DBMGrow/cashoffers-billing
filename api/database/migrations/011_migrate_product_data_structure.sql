-- Migration: Move user_config and team info into cashoffers section, remove legacy root-level fields
--
-- Before: { team: true, team_members: 6, user_config: {...}, duration, renewal_cost, ... }
-- After:  { cashoffers: { managed: true/false, user_config: { ..., team_members: 6 } }, duration, renewal_cost, ... }
--
-- Changes:
--   1. Move user_config into cashoffers.user_config (with managed flag)
--   2. Move team_members from root into cashoffers.user_config.team_members
--   3. Remove root-level team, team_members, and user_config fields
--
-- Rules by product_category:
--   premium_cashoffers  → cashoffers.managed = true, move user_config + team_members into cashoffers
--   external_cashoffers → cashoffers.managed = false, remove root user_config/team fields
--   homeuptick_only     → already has cashoffers section, just remove root user_config/team fields

-- ============================================================================
-- premium_cashoffers: Individual products (no team)
-- ============================================================================

-- Product 1: Individual (kwofferings, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 1;

-- Product 13: Individual (yhsgr, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 13;

-- Product 21: Individual (uco, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 21;

-- Product 26: Individual (mop, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 26;

-- Product 33: Individual (eco, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 33;

-- Product 38: Individual (iop, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 38;

-- Product 42: Individual (default, AGENT)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 42;

-- ============================================================================
-- premium_cashoffers: Investor products (no team)
-- ============================================================================

-- Product 11: Investor (default, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 11;

-- Product 46: Investor (kwofferings, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 46;

-- Product 47: Investor (yhsgr, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 47;

-- Product 48: Investor (iop, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 48;

-- Product 49: Investor (uco, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 49;

-- Product 50: Investor (mop, INVESTOR)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 1, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 50;

-- ============================================================================
-- premium_cashoffers: Free tier products (no team)
-- ============================================================================

-- Product 51: Free Agent (kwofferings, AGENT, is_premium=0)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "AGENT", "is_premium": 0, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 51;

-- Product 52: Free Investor (kwofferings, INVESTOR, is_premium=0)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "INVESTOR", "is_premium": 0, "is_team_plan": false}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 52;

-- ============================================================================
-- premium_cashoffers: Team products (kwofferings)
-- ============================================================================

-- Product 2: Small Team (kwofferings, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 2;

-- Product 3: Medium Team (kwofferings, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 3;

-- Product 4: Large Team (kwofferings, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 4;

-- Product 5: Custom Team 20 (kwofferings, 20 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 20}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 5;

-- Product 6: Custom Team 50 (kwofferings, 50 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 50}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 6;

-- Product 7: Custom Team 75 (kwofferings, 75 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 75}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 7;

-- Product 8: Custom Team 100 (kwofferings, 100 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 100}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 8;

-- Product 9: Custom Team 200 (kwofferings, 200 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 200}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 9;

-- ============================================================================
-- premium_cashoffers: Team products (yhsgr)
-- ============================================================================

-- Product 14: Small Team (yhsgr, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 14;

-- Product 15: Medium Team (yhsgr, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 15;

-- Product 16: Large Team (yhsgr, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 16;

-- Product 17: Mini Team (yhsgr, 3 members, price=0)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 17;

-- Product 18: Mini Team (yhsgr, 3 members, price=25000)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 18;

-- ============================================================================
-- premium_cashoffers: Team products (uco)
-- ============================================================================

-- Product 22: 3 Agents (uco, 3 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 22;

-- Product 23: 6 Agents (uco, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 23;

-- Product 24: 11 Agents (uco, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 24;

-- Product 25: 16 Agents (uco, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 25;

-- ============================================================================
-- premium_cashoffers: Team products (mop)
-- ============================================================================

-- Product 27: 3 Agents (mop, 3 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 27;

-- Product 28: 6 Agents (mop, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 28;

-- Product 29: 11 Agents (mop, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 29;

-- Product 30: 16 Agents (mop, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 30;

-- ============================================================================
-- premium_cashoffers: Team products (eco)
-- ============================================================================

-- Product 34: 3 Agents (eco, 3 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 3}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 34;

-- Product 35: 6 Agents (eco, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 35;

-- Product 36: 11 Agents (eco, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 36;

-- Product 37: 16 Agents (eco, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 37;

-- ============================================================================
-- premium_cashoffers: Team products (iop)
-- ============================================================================

-- Product 39: Small Team (iop, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 39;

-- Product 40: Medium Team (iop, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 40;

-- Product 41: Large Team (iop, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 41;

-- ============================================================================
-- premium_cashoffers: Team products (default)
-- ============================================================================

-- Product 43: Small Team (default, 6 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 6}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 43;

-- Product 44: Medium Team (default, 11 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 11}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 44;

-- Product 45: Large Team (default, 16 members)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "TEAMOWNER", "is_premium": 1, "is_team_plan": true, "team_members": 16}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 45;

-- ============================================================================
-- external_cashoffers: remove root user_config and team fields
-- ============================================================================

-- Product 20: KW HomeUptick (legacy — needs cashoffers.managed=false added and homeuptick config)
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data,
    '$.cashoffers', CAST('{"managed": false}' AS JSON),
    '$.homeuptick', CAST('{"enabled": true, "base_contacts": 50}' AS JSON)
  ),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 20;

-- Product 53: HomeUptick Access (kwofferings) — already has cashoffers, just remove root fields
UPDATE Products SET data = JSON_REMOVE(data, '$.user_config', '$.team', '$.team_members')
WHERE product_id = 53;

-- Product 55: HomeUptick Access (default) — already clean

-- ============================================================================
-- homeuptick_only: remove root user_config and team fields
-- ============================================================================

-- Product 54: HomeUptick (standalone) — remove root fields and rewrite cashoffers
UPDATE Products SET data = JSON_REMOVE(
  JSON_SET(data, '$.cashoffers', CAST('{"managed": true, "user_config": {"role": "SHELL", "is_premium": 0}}' AS JSON)),
  '$.user_config', '$.team', '$.team_members'
) WHERE product_id = 54;
