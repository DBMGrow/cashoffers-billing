# Integration: HomeUptick

## Purpose
HomeUptick is a third-party service with its own subscription tiers. Users on certain CashOffers plans can have a HomeUptick addon subscription. Billing fetches the user's current tier to determine renewal cost.

## Key Files
- `api/infrastructure/external-api/homeuptick-api/homeuptick-api.client.ts`
- `api/utils/getHomeUptickSubscription.ts` — find HomeUptick addon in user's subscriptions

## Config
```
HOMEUPTICK_URL=https://...
```

## What We Use
- **Get tier**: Fetch user's current HomeUptick tier to determine addon renewal amount

## Notes
- HomeUptick addon is a separate subscription record in our DB
- Tier-based renewal cost has a known TODO — see [HomeUptick Integration capability](../../business/capabilities/homeuptick-integration.md)
- If HomeUptick API is unavailable, addon renewal fails independently of main subscription
