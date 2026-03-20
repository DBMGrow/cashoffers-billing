# Component: Event Bus

## What It Does
Dispatches domain events synchronously within a single request/cron cycle. Allows use cases to emit events without directly coupling to downstream handlers.

## Key Files
- `api/infrastructure/events/in-memory-event-bus.ts`
- `api/domain/events/` — 15 event type definitions
- `api/application/event-handlers/` — 6 registered handlers

## Domain Events
- `SubscriptionCreated`
- `SubscriptionRenewed`
- `SubscriptionCancelled`
- `SubscriptionPaused`
- `SubscriptionResumed`
- `PaymentProcessed`
- `PaymentFailed`
- `TrialStarted`
- `TrialExpired`
- (and others)

## How It Works
1. Use case emits an event: `eventBus.publish(new SubscriptionRenewed(...))`
2. Event bus calls all registered handlers synchronously
3. Handlers trigger side effects (emails, external API calls, logging)

## Inputs
- Domain events emitted by use cases

## Outputs
- Side effects: emails sent, external API updated, logs written

## Failure Modes
- Handler throws → event bus propagates the error (synchronous)
- No async retry — if a handler fails, the entire operation may fail

## Gaps vs Intended Behavior
- Synchronous dispatch means a slow handler blocks the main flow
- No dead-letter queue or retry for failed handlers
- Consider async dispatch for non-critical side effects (email, logging)
