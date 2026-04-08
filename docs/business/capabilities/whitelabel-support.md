# Capability: Whitelabel Support

## Business Outcome
Different partner brands can offer CashOffers subscriptions under their own branding. Users see a branded checkout and are assigned to the correct whitelabel account.

## Actors
- **Partner**: Owns the whitelabel brand
- **User**: Subscribes via a whitelabel-branded URL
- **System**: Routes user to correct products and assigns whitelabel ID

## What Should Happen

1. User visits `/[whitelabel_code]/subscribe/[product]`
2. System looks up whitelabel by code
3. Filters available products to those associated with this whitelabel
4. On purchase: assigns `white_label_id` to the user in main API

## Edge Cases
- Unknown whitelabel code → 404
- Product not associated with this whitelabel → not shown in product list
- User with existing whitelabel assignment purchases a different whitelabel product → unclear (see Unknowns)

## Current vs Intended Behavior
- Whitelabel email customization is implemented (see `WHITELABEL_EMAIL_IMPLEMENTATION.md` — now removed; info captured here).
- Whitelabel-specific email templates can be used if configured.

## Unknowns
- Behavior when a user switches between whitelabel products is not documented.
- Whether a user can belong to multiple whitelabels simultaneously is unclear.
