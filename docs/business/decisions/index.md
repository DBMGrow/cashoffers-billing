# Decisions

Why things are built the way they are.

| Decision | Description |
|----------|-------------|
| [Clean Architecture](clean-architecture) | Why we use use-cases, domain, infrastructure layers |
| [Product-Driven User Config](product-driven-user-config) | Why products define user roles and premium state |
| [Amounts in Cents](amounts-in-cents) | Why all monetary values are stored/passed as cents |
| [dotenvx](dotenvx) | Encrypted secrets with dotenvx — no .env.keys, keys in Keeper |
| [Product Categories](product-categories) | Why products have an explicit category column (premium_cashoffers, external_cashoffers, homeuptick_only) |
| [HomeUptick Data Ownership](homeuptick-data-ownership) | Why HU config lives in Homeuptick_Subscriptions, not in subscription JSON |
| [Products Name a Tier (role_v2)](role-v2) | Why a product names a role in the unified vocabulary instead of a role plus a premium bit |
