# Monitoring System Quick Reference

## Daily Health Reports

### Endpoint
```
POST /cron/health-report
```

### Request
```json
{
  "secret": "your-cron-secret",
  "date": "2024-03-15"  // optional
}
```

### Schedule
Daily at 9:00 AM (recommended)

### Recipients
- `DEV_EMAIL` (primary)
- `ADMIN_EMAIL` (fallback/CC)

## Critical Alerts

### Quick Usage

```typescript
import { getContainer } from '@/container'

const container = getContainer()
const alert = container.services.criticalAlert

// Square API
await alert.alertSquareApiFailure(error, context)

// Main API
await alert.alertMainApiFailure(error, context)

// Database
await alert.alertDatabaseError(error, context)

// Payment
await alert.alertPaymentProcessingError(error, context)

// Cron
await alert.alertCronJobFailure('jobName', error, context)

// Generic
await alert.alertCriticalError('Error Type', error, context)
```

### When to Alert

✅ **DO Alert**
- External service failures
- Database errors
- Infrastructure issues
- Cron job failures
- Data integrity issues

❌ **DON'T Alert**
- User input errors
- Card declined (normal)
- Validation failures
- Recoverable errors with retry

## Environment Variables

```bash
# Required
DEV_EMAIL=dev@yourcompany.com
CRON_SECRET=your-secret-here

# Optional (fallback recipient)
ADMIN_EMAIL=admin@yourcompany.com
```

## Health Status Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Failed renewals | > 5 | > 10 |
| Total errors | > 20 | - |
| Critical errors | - | > 0 |
| Retry queue | > 15 | - |

## Alert Cooldown

Same alert won't send again for **5 minutes**

## Files

- [MONITORING.md](./MONITORING.md) - Full documentation
- [CRITICAL_ALERTS_INTEGRATION.md](./CRITICAL_ALERTS_INTEGRATION.md) - Integration guide
- [api/domain/services/health-metrics.service.ts](../api/domain/services/health-metrics.service.ts)
- [api/domain/services/health-report.service.ts](../api/domain/services/health-report.service.ts)
- [api/domain/services/critical-alert.service.ts](../api/domain/services/critical-alert.service.ts)
- [api/templates/mjml/daily-health-report.mjml](../api/templates/mjml/daily-health-report.mjml)
