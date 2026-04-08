# Decision: Monetary Amounts Stored in Cents

## Context
Floating point arithmetic causes rounding errors with decimal dollar values. APIs and databases need a consistent representation.

## Decision
All monetary amounts throughout the system are integers in **cents**.

- $25.00 → `2500`
- $250.00 → `25000`

## Impact
- Every amount stored in the database is cents
- Square API also uses cents — no conversion needed at payment time
- Display formatting: `(cents / 100).toFixed(2)` or use the `Money` value object
- Any new code handling amounts must use cents
