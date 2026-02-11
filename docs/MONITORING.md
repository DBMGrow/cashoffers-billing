# Monitoring and Alerting System

This document describes the comprehensive monitoring and alerting system for the CashOffers billing service.

## Overview

The monitoring system provides two key capabilities:

1. **Daily Health Reports**: Automated daily summaries of system health, metrics, and performance
2. **Critical Error Alerting**: Immediate notifications for critical system failures

## Daily Health Reports

### What's Included

Daily health reports provide a comprehensive overview of the billing system's health over the past 24 hours:

#### Subscription Metrics
- Successful renewals
- Failed renewals
- New subscriptions
- Cancelled subscriptions
- Active subscriptions (current count)
- Subscriptions in retry queue
- Paused subscriptions

#### Payment Metrics
- Total revenue (in dollars)
- Successful payments
- Failed payments
- Refunds processed
- Average transaction value

#### Error Metrics
- Total errors logged
- Critical errors (database, API, Square failures)
- Recent error details (last 10)
- Top failure reasons with occurrence counts

#### System Status
The report includes an overall health status:
- **✓ Healthy**: All systems operating normally
- **⚠ Warning**: Elevated errors or failures requiring attention
- **✗ Critical**: Critical errors detected, immediate action required

### Setup

#### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Primary recipient for health reports and alerts
DEV_EMAIL=dev@yourcompany.com

# Fallback recipient (optional, if different from dev)
ADMIN_EMAIL=admin@yourcompany.com
```

**Note**: Reports are sent to `DEV_EMAIL` first. If `ADMIN_EMAIL` is also set and different, it will receive copies as well.

#### 2. Schedule the Cron Job

Set up a daily cron job to call the health report endpoint. For example, using a service like cron-job.org or your cloud provider's scheduler:

**Endpoint**: `POST /cron/health-report`

**Request Body**:
```json
{
  "secret": "your-cron-secret"
}
```

**Optional - specify a custom date**:
```json
{
  "secret": "your-cron-secret",
  "date": "2024-03-15"
}
```

**Recommended Schedule**: Daily at 9:00 AM in your timezone

#### Example cURL Command

```bash
curl -X POST https://your-billing-api.com/cron/health-report \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-cron-secret"}'
```

### Email Template

The daily report uses an MJML template ([api/templates/mjml/daily-health-report.mjml](../api/templates/mjml/daily-health-report.mjml)) that provides:

- Color-coded status indicators
- Mobile-responsive design
- Clear metric visualization
- Actionable recommendations
- Recent error details

### Health Status Thresholds

The system automatically determines overall health based on these thresholds:

| Condition | Status | Threshold |
|-----------|--------|-----------|
| Critical errors > 0 | Critical | Any critical error |
| Failed renewals > 10 | Critical | High failure rate |
| Total errors > 20 | Warning | Elevated error count |
| Failed renewals > 5 | Warning | Moderate failures |
| Subscriptions in retry > 15 | Warning | High retry queue |
| All good | Healthy | Below all thresholds |

### Action Items

When issues are detected, the report automatically includes action items:

- Review critical errors immediately
- Investigate failed renewals
- Monitor retry queue
- Review payment gateway logs
- Check application logs

## Critical Error Alerting

### Immediate Notifications

The system sends immediate email alerts for these critical errors:

#### 1. Square API Failures
- Payment processing disrupted
- API not responding or returning errors
- **Action**: Check Square API status and credentials

#### 2. Main API Connectivity Failures
- Cannot connect to CashOffers main API
- User operations blocked
- **Action**: Verify main API status and network connectivity

#### 3. Database Errors
- Database connection failures
- Query failures
- **Action**: Check database status and connection pool

#### 4. Critical Payment Processing Errors
- Payment failures after retries exhausted
- **Action**: Review transaction logs and contact affected users

#### 5. Cron Job Failures
- Subscription renewal cron failed
- Other scheduled jobs failed
- **Action**: Review cron logs and restart job if needed

### Alert Deduplication

To prevent alert spam, the system includes a **5-minute cooldown period** for duplicate alerts. The same error won't trigger multiple alerts within this window.

### Alert Format

Critical alerts are sent as both plain text and HTML with:

- 🚨 Severity indicator (CRITICAL/HIGH/MEDIUM)
- Error details and stack trace
- Contextual information
- Recommended actions
- Timestamp and environment

### Email Recipients

Critical alerts are sent to:
1. `DEV_EMAIL` (primary recipient)
2. `ADMIN_EMAIL` (fallback/CC, if configured and different from dev)

## Using the Critical Alert Service

### In Use Cases and Services

To send critical alerts from your code:

```typescript
import { getContainer } from '@/container'

// In your use case or service
const container = getContainer()
const criticalAlert = container.services.criticalAlert

try {
  // Your code here
} catch (error) {
  // Send appropriate alert
  await criticalAlert.alertSquareApiFailure(error, {
    userId: 123,
    operation: 'createPayment',
  })
  throw error
}
```

### Available Alert Methods

```typescript
// Square API failures
await criticalAlert.alertSquareApiFailure(error, context)

// Main API connectivity
await criticalAlert.alertMainApiFailure(error, context)

// Database errors
await criticalAlert.alertDatabaseError(error, context)

// Email service failures (logs only, can't email about email failures)
await criticalAlert.alertEmailServiceFailure(error, context)

// Payment processing
await criticalAlert.alertPaymentProcessingError(error, context)

// Cron job failures
await criticalAlert.alertCronJobFailure('subscriptionsCron', error, context)

// Generic critical error
await criticalAlert.alertCriticalError('Custom Error Type', error, context)
```

## Architecture

### Services

#### HealthMetricsService
- **Location**: [api/domain/services/health-metrics.service.ts](../api/domain/services/health-metrics.service.ts)
- **Purpose**: Gathers raw metrics from database
- **Dependencies**: Transaction, Subscription, BillingLog repositories

#### HealthReportService
- **Location**: [api/domain/services/health-report.service.ts](../api/domain/services/health-report.service.ts)
- **Purpose**: Formats metrics and sends email reports
- **Dependencies**: HealthMetricsService, EmailService, Logger

#### CriticalAlertService
- **Location**: [api/domain/services/critical-alert.service.ts](../api/domain/services/critical-alert.service.ts)
- **Purpose**: Sends immediate notifications for critical errors
- **Dependencies**: EmailService, Config, Logger
- **Features**: Alert deduplication, severity levels, formatted output

### Database Tables Used

- **Transactions**: Payment and subscription transaction history
- **Subscriptions**: Subscription status and renewal information
- **BillingLogs**: Application error and event logs

## Testing the System

### Test Daily Health Report

```bash
# Manually trigger a health report
curl -X POST http://localhost:3000/cron/health-report \
  -H "Content-Type: application/json" \
  -d '{"secret": "your-cron-secret"}'
```

### Test Critical Alerts

You can test critical alerts by temporarily adding alert code to a route:

```typescript
import { getContainer } from '@/container'

const container = getContainer()
await container.services.criticalAlert.alertCriticalError(
  'Test Alert',
  new Error('This is a test'),
  { test: true }
)
```

## Best Practices

### When to Use Daily Reports
- System health monitoring
- Trend analysis
- Capacity planning
- Regular stakeholder updates

### When to Use Critical Alerts
- Service disruptions
- Payment gateway failures
- Database connectivity issues
- Authentication/security problems
- Unrecoverable errors

### What NOT to Alert On
- Expected validation errors
- User input errors
- Recoverable errors with retries
- Low-severity warnings

## Maintenance

### Reviewing Logs

Check the BillingLogs table for historical error data:

```sql
SELECT * FROM BillingLogs
WHERE level = 'error'
AND createdAt > DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY createdAt DESC;
```

### Adjusting Thresholds

To modify health status thresholds, update the `determineOverallStatus` method in [api/domain/services/health-report.service.ts](../api/domain/services/health-report.service.ts).

### Customizing Templates

To modify the daily report appearance, edit [api/templates/mjml/daily-health-report.mjml](../api/templates/mjml/daily-health-report.mjml) and regenerate HTML:

```bash
npm run preview:emails
```

## Troubleshooting

### Not Receiving Daily Reports

1. Check that the cron job is running
2. Verify `DEV_EMAIL` is set in environment variables (required)
3. Check SendGrid API key is valid
4. Review application logs for email sending errors
5. Ensure the email address is valid and can receive emails

### Not Receiving Critical Alerts

1. Verify email service is functioning
2. Check that errors are being thrown in the code
3. Verify alert methods are being called with `await`
4. Check for alert cooldown (5-minute window)

### False Positives

If you're getting too many warnings:
1. Review and adjust thresholds in HealthReportService
2. Consider increasing cooldown period in CriticalAlertService
3. Update error classification logic

## Future Enhancements

Potential improvements to the monitoring system:

- [ ] Slack/Discord webhook integration
- [ ] PagerDuty integration for on-call rotation
- [ ] Custom metric dashboards
- [ ] Anomaly detection (ML-based)
- [ ] Performance metric tracking (response times, throughput)
- [ ] Cost tracking and reporting
- [ ] User behavior analytics
- [ ] A/B test result tracking
