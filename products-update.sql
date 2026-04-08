UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 2, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 1;

UPDATE `Products`
SET
  `product_name` = 'Small Team',
  `product_description` = 'Owner plus up to 5 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 2;

UPDATE `Products`
SET
  `product_name` = 'Medium Team',
  `product_description` = 'Owner plus up to 10 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 3;

UPDATE `Products`
SET
  `product_name` = 'Large Team',
  `product_description` = 'Owner plus up to 15 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 4;

UPDATE `Products`
SET
  `product_name` = 'Custom Team (20)',
  `product_description` = '20 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 200000, "team_members": 20, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 5;

UPDATE `Products`
SET
  `product_name` = 'Custom Team (50)',
  `product_description` = '50 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 50, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 6;

UPDATE `Products`
SET
  `product_name` = 'Custom Team (75)',
  `product_description` = '75 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 150000, "team_members": 75, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 7;

UPDATE `Products`
SET
  `product_name` = 'Custom Team (100)',
  `product_description` = '100 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 25000, "team_members": 100, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 8;

UPDATE `Products`
SET
  `product_name` = 'Custom Team (200)',
  `product_description` = '200 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 1500000, "team_members": 200, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 2, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 9;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'default',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 1, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 11;

UPDATE `Products`
SET
  `product_name` = 'Property Unlock',
  `product_description` = NULL,
  `product_type` = 'one-time',
  `whitelabel_code` = NULL,
  `price` = 5000,
  `data` = NULL,
  `updatedAt` = NOW ()
WHERE
  `product_id` = 12;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 3, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 13;

UPDATE `Products`
SET
  `product_name` = 'Small Team',
  `product_description` = 'up to 5 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 3, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 14;

UPDATE `Products`
SET
  `product_name` = 'Medium Team',
  `product_description` = 'up to 10 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 3, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 15;

UPDATE `Products`
SET
  `product_name` = 'Large Team',
  `product_description` = 'up to 15 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 3, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 16;

UPDATE `Products`
SET
  `product_name` = 'Mini Team',
  `product_description` = 'up to 3 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 50000, "team_members": 3, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 3, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 17;

UPDATE `Products`
SET
  `product_name` = 'Mini Team',
  `product_description` = 'up to 3 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 50000, "team_members": 3, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 3, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 18;

UPDATE `Products`
SET
  `product_name` = 'KW HomeUptick',
  `product_description` = NULL,
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 0,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 0, "team_members": 0, "user_config": {"is_premium": 1, "role": "SHELL", "whitelabel_id": 2, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 20;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 0,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 29900, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 5, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 21;

UPDATE `Products`
SET
  `product_name` = '3 Agents',
  `product_description` = 'up to 3 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 59900, "team_members": 3, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 5, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 22;

UPDATE `Products`
SET
  `product_name` = '6 Agents',
  `product_description` = 'up to 6 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 94900, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 5, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 23;

UPDATE `Products`
SET
  `product_name` = '11 Agents',
  `product_description` = 'up to 11 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 149900, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 5, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 24;

UPDATE `Products`
SET
  `product_name` = '16 Agents',
  `product_description` = 'up to 16 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 199900, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 5, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 25;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 0,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 6, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 26;

UPDATE `Products`
SET
  `product_name` = '3 Agents',
  `product_description` = 'up to 3 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 50000, "team_members": 3, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 6, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 27;

UPDATE `Products`
SET
  `product_name` = '6 Agents',
  `product_description` = 'up to 6 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 6, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 28;

UPDATE `Products`
SET
  `product_name` = '11 Agents',
  `product_description` = 'up to 11 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 6, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 29;

UPDATE `Products`
SET
  `product_name` = '16 Agents',
  `product_description` = 'up to 16 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 6, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 30;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'eco',
  `price` = 0,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 7, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 33;

UPDATE `Products`
SET
  `product_name` = '3 Agents',
  `product_description` = 'up to 3 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'eco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 50000, "team_members": 3, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 7, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 34;

UPDATE `Products`
SET
  `product_name` = '6 Agents',
  `product_description` = 'up to 6 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'eco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 7, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 35;

UPDATE `Products`
SET
  `product_name` = '11 Agents',
  `product_description` = 'up to 11 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'eco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 7, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 36;

UPDATE `Products`
SET
  `product_name` = '16 Agents',
  `product_description` = 'up to 16 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'eco',
  `price` = 0,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 7, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 37;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'iop',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 4, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 38;

UPDATE `Products`
SET
  `product_name` = 'Small Team',
  `product_description` = 'Owner plus up to 5 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'iop',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 4, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 39;

UPDATE `Products`
SET
  `product_name` = 'Medium Team',
  `product_description` = 'Owner plus up to 10 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'iop',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 4, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 40;

UPDATE `Products`
SET
  `product_name` = 'Large Team',
  `product_description` = 'Owner plus up to 15 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'iop',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 4, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 41;

UPDATE `Products`
SET
  `product_name` = 'Individual',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'default',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 25000, "user_config": {"is_premium": 1, "role": "AGENT", "whitelabel_id": 1, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 42;

UPDATE `Products`
SET
  `product_name` = 'Small Team',
  `product_description` = 'Owner plus up to 5 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'default',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 85000, "team_members": 6, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 1, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 43;

UPDATE `Products`
SET
  `product_name` = 'Medium Team',
  `product_description` = 'Owner plus up to 10 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'default',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 137500, "team_members": 11, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 1, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 44;

UPDATE `Products`
SET
  `product_name` = 'Large Team',
  `product_description` = 'Owner plus up to 15 users',
  `product_type` = 'subscription',
  `whitelabel_code` = 'default',
  `price` = 25000,
  `data` = '{"team": true, "duration": "monthly", "renewal_cost": 175000, "team_members": 16, "user_config": {"is_premium": 1, "role": "TEAMOWNER", "whitelabel_id": 1, "is_team_plan": true}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 45;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'kwofferings',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 2, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 46;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'yhsgr',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 3, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 47;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'iop',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 4, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 48;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'uco',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 5, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 49;

UPDATE `Products`
SET
  `product_name` = 'Investor',
  `product_description` = 'Individual',
  `product_type` = 'subscription',
  `whitelabel_code` = 'mop',
  `price` = 25000,
  `data` = '{"team": false, "duration": "monthly", "renewal_cost": 9900, "user_config": {"is_premium": 1, "role": "INVESTOR", "whitelabel_id": 6, "is_team_plan": false}}',
  `updatedAt` = NOW ()
WHERE
  `product_id` = 50;

-- Free Agent product (replaces "free" magic string) — available for all whitelabels
INSERT INTO
  `Products` (
    `product_name`,
    `product_description`,
    `product_type`,
    `whitelabel_code`,
    `price`,
    `data`,
    `active`,
    `createdAt`,
    `updatedAt`
  )
VALUES
  (
    'Free Agent',
    'Free agent account',
    'subscription',
    NULL,
    0,
    '{"signup_fee": 0, "renewal_cost": 0, "duration": "monthly", "user_config": {"is_premium": 0, "role": "AGENT", "whitelabel_id": 4, "is_team_plan": false}}',
    1,
    NOW (),
    NOW ()
  );

-- Free Investor product (replaces "freeinvestor" magic string) — available for all whitelabels
INSERT INTO
  `Products` (
    `product_name`,
    `product_description`,
    `product_type`,
    `whitelabel_code`,
    `price`,
    `data`,
    `active`,
    `createdAt`,
    `updatedAt`
  )
VALUES
  (
    'Free Investor',
    'Free investor account',
    'subscription',
    NULL,
    0,
    '{"signup_fee": 0, "renewal_cost": 0, "duration": "monthly", "user_config": {"is_premium": 0, "role": "INVESTOR", "whitelabel_id": 4, "is_team_plan": false}}',
    1,
    NOW (),
    NOW ()
  );

-- Free Agent product for KW Offerings (whitelabel_id=2, whitelabel_code=kwofferings)
INSERT INTO
  `Products` (
    `product_name`,
    `product_description`,
    `product_type`,
    `whitelabel_code`,
    `price`,
    `data`,
    `createdAt`,
    `updatedAt`
  )
VALUES
  (
    'Free Agent',
    'Free agent account',
    'subscription',
    'kwofferings',
    0,
    '{"signup_fee": 0, "renewal_cost": 0, "duration": "monthly", "user_config": {"is_premium": 0, "role": "AGENT", "whitelabel_id": 2, "is_team_plan": false}}',
    NOW (),
    NOW ()
  );

INSERT INTO
  `Products` (
    `product_name`,
    `product_description`,
    `product_type`,
    `whitelabel_code`,
    `price`,
    `data`,
    `createdAt`,
    `updatedAt`
  )
VALUES
  (
    'Free Investor',
    'Free investor account',
    'subscription',
    'kwofferings',
    0,
    '{"signup_fee": 0, "renewal_cost": 0, "duration": "monthly", "user_config": {"is_premium": 0, "role": "INVESTOR", "whitelabel_id": 2, "is_team_plan": false}}',
    NOW (),
    NOW ()
  );
