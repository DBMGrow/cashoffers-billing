import { describe, it, expect } from 'vitest'
import { render } from '@react-email/render'
import { createElement } from 'react'

import PaymentConfirmationEmail from './payment-confirmation.email'
import PaymentErrorEmail from './payment-error.email'
import SubscriptionCreatedEmail from './subscription-created.email'
import SubscriptionRenewalEmail from './subscription-renewal.email'
import SubscriptionRenewalFailedEmail from './subscription-renewal-failed.email'
import SubscriptionCancelledEmail from './subscription-cancelled.email'
import SubscriptionDowngradedEmail from './subscription-downgraded.email'
import SubscriptionPausedEmail from './subscription-paused.email'
import SubscriptionSuspendedEmail from './subscription-suspended.email'
import CardUpdatedEmail from './card-updated.email'
import RefundEmail from './refund.email'
import PropertyUnlockedEmail from './property-unlocked.email'
import DailyHealthReportEmail from './daily-health-report.email'
import type { DailyHealthReportEmailProps } from './daily-health-report.email'

// ─── Helpers ────────────────────────────────────────────────────────────────

async function renderTemplate<P extends object>(component: React.ComponentType<P>, props: P): Promise<string> {
  return render(createElement(component, props))
}

const baseHealthReport: DailyHealthReportEmailProps = {
  reportDate: 'February 27, 2026',
  overallStatusText: '✓ Healthy',
  overallStatusColor: '#16a34a',
  statusMessage: 'All systems operating normally.',
  totalRevenue: '$1,234.56',
  averageTransactionValue: '$49.00',
  successfulRenewals: 42,
  failedRenewals: 0,
  failedRenewalsColor: '#6b7280',
  newSubscriptions: 5,
  cancelledSubscriptions: 1,
  activeSubscriptions: 200,
  subscriptionsInRetry: 0,
  retryColor: '#6b7280',
  pausedSubscriptions: 3,
  successfulPayments: 47,
  failedPayments: 0,
  failedPaymentsColor: '#6b7280',
  refunds: 1,
  totalErrors: 2,
  totalErrorsColor: '#6b7280',
  criticalErrors: 0,
  criticalErrorsColor: '#16a34a',
}

// ─── Payment Confirmation ───────────────────────────────────────────────────

describe('PaymentConfirmationEmail', () => {
  it('renders amount and transaction ID', async () => {
    const html = await renderTemplate(PaymentConfirmationEmail, {
      amount: '$250.00',
      transactionID: 'TXN-20240131-ABC123',
      date: 'January 31, 2024',
    })
    expect(html).toContain('$250.00')
    expect(html).toContain('TXN-20240131-ABC123')
    expect(html).toContain('January 31, 2024')
  })

  it('does not include sandbox banner in production', async () => {
    const html = await renderTemplate(PaymentConfirmationEmail, {
      amount: '$250.00',
      transactionID: 'TXN-001',
      date: 'January 31, 2024',
    })
    expect(html).not.toContain('TEST ENVIRONMENT')
  })

  it('includes sandbox banner when isSandbox is true', async () => {
    const html = await renderTemplate(PaymentConfirmationEmail, {
      amount: '$250.00',
      transactionID: 'TXN-001',
      date: 'January 31, 2024',
      isSandbox: true,
    })
    expect(html).toContain('TEST ENVIRONMENT')
  })
})

// ─── Payment Error ──────────────────────────────────────────────────────────

describe('PaymentErrorEmail', () => {
  it('renders error message and update URL', async () => {
    const html = await renderTemplate(PaymentErrorEmail, {
      amount: '$99.00',
      errorMessage: 'Card declined',
      updatePaymentUrl: 'https://billing.example.com',
      date: 'January 31, 2024',
    })
    expect(html).toContain('Card declined')
    expect(html).toContain('https://billing.example.com')
    expect(html).toContain('$99.00')
  })
})

// ─── Subscription Created ───────────────────────────────────────────────────

describe('SubscriptionCreatedEmail', () => {
  it('renders subscription name, amount, and line items', async () => {
    const html = await renderTemplate(SubscriptionCreatedEmail, {
      subscription: 'Premium Plan',
      amount: '$148.00',
      lineItems: [
        { description: 'Signup Fee', amount: 4900 },
        { description: 'Premium Plan', amount: 9900 },
      ],
      date: 'January 31, 2024',
    })
    expect(html).toContain('Premium Plan')
    expect(html).toContain('$148.00')
    expect(html).toContain('Signup Fee')
    expect(html).toContain('$49.00')
    expect(html).toContain('$99.00')
    expect(html).toContain('January 31, 2024')
  })

  it('renders sandbox banner when isSandbox is true', async () => {
    const html = await renderTemplate(SubscriptionCreatedEmail, {
      subscription: 'Premium Plan',
      amount: '$148.00',
      lineItems: [],
      date: 'January 31, 2024',
      isSandbox: true,
    })
    expect(html).toContain('TEST ENVIRONMENT')
  })
})

// ─── Subscription Renewal ───────────────────────────────────────────────────

describe('SubscriptionRenewalEmail', () => {
  it('renders renewal content with line items', async () => {
    const html = await renderTemplate(SubscriptionRenewalEmail, {
      subscription: 'Premium Plan',
      amount: '$99.00',
      lineItems: [{ description: 'Premium Plan', amount: 9900 }],
      date: 'February 1, 2024',
    })
    expect(html).toContain('Premium Plan')
    expect(html).toContain('$99.00')
    expect(html).toContain('February 1, 2024')
  })
})

// ─── Subscription Renewal Failed ───────────────────────────────────────────

describe('SubscriptionRenewalFailedEmail', () => {
  it('renders subscription name and update link', async () => {
    const html = await renderTemplate(SubscriptionRenewalFailedEmail, {
      subscription: 'Premium Plan',
      date: 'February 1, 2024',
      link: 'https://billing.example.com',
    })
    expect(html).toContain('Premium Plan')
    expect(html).toContain('https://billing.example.com')
  })
})

// ─── Subscription Cancelled ─────────────────────────────────────────────────

describe('SubscriptionCancelledEmail', () => {
  it('renders subscription name and cancellation heading', async () => {
    const html = await renderTemplate(SubscriptionCancelledEmail, {
      subscription: 'Premium Monthly',
    })
    expect(html).toContain('Premium Monthly')
    expect(html).toContain('Cancellation')
  })

  it('renders effective date when provided', async () => {
    const html = await renderTemplate(SubscriptionCancelledEmail, {
      subscription: 'Premium Monthly',
      effectiveDate: 'February 28, 2024',
    })
    expect(html).toContain('February 28, 2024')
  })
})

// ─── Subscription Downgraded ────────────────────────────────────────────────

describe('SubscriptionDowngradedEmail', () => {
  it('renders current subscription name', async () => {
    const html = await renderTemplate(SubscriptionDowngradedEmail, {
      subscription: 'Premium Annual',
    })
    expect(html).toContain('Premium Annual')
    expect(html).toContain('Downgrade')
  })

  it('renders target plan and effective date when provided', async () => {
    const html = await renderTemplate(SubscriptionDowngradedEmail, {
      subscription: 'Premium Annual',
      targetPlan: 'Premium Monthly',
      effectiveDate: 'February 28, 2024',
    })
    expect(html).toContain('Premium Monthly')
    expect(html).toContain('February 28, 2024')
  })
})

// ─── Subscription Paused ───────────────────────────────────────────────────

describe('SubscriptionPausedEmail', () => {
  it('renders subscription name', async () => {
    const html = await renderTemplate(SubscriptionPausedEmail, {
      subscription: 'Premium Plan',
    })
    expect(html).toContain('Premium Plan')
    expect(html).toContain('Paused')
  })
})

// ─── Subscription Suspended ────────────────────────────────────────────────

describe('SubscriptionSuspendedEmail', () => {
  it('renders subscription name and update link', async () => {
    const html = await renderTemplate(SubscriptionSuspendedEmail, {
      subscription: 'Premium Plan',
      link: 'https://billing.example.com',
    })
    expect(html).toContain('Premium Plan')
    expect(html).toContain('https://billing.example.com')
  })
})

// ─── Card Updated ──────────────────────────────────────────────────────────

describe('CardUpdatedEmail', () => {
  it('renders card last 4 and message', async () => {
    const html = await renderTemplate(CardUpdatedEmail, {
      message: 'Your payment method has been updated.',
      card: '**** **** **** 4242',
      date: 'January 31, 2024',
    })
    expect(html).toContain('4242')
    expect(html).toContain('Your payment method has been updated.')
  })
})

// ─── Refund ────────────────────────────────────────────────────────────────

describe('RefundEmail', () => {
  it('renders refund amount and date', async () => {
    const html = await renderTemplate(RefundEmail, {
      amount: '$250.00',
      date: 'January 31, 2024',
    })
    expect(html).toContain('$250.00')
    expect(html).toContain('January 31, 2024')
    expect(html).toContain('Refunded')
  })
})

// ─── Property Unlocked ────────────────────────────────────────────────────

describe('PropertyUnlockedEmail', () => {
  it('renders property address, amount, and transaction ID', async () => {
    const html = await renderTemplate(PropertyUnlockedEmail, {
      propertyAddress: '1234 Oak Ridge Dr, Springfield, IL',
      amount: '$50.00',
      transactionID: 'TXN-987654321',
      date: 'April 7, 2026',
    })
    expect(html).toContain('1234 Oak Ridge Dr, Springfield, IL')
    expect(html).toContain('$50.00')
    expect(html).toContain('TXN-987654321')
    expect(html).toContain('April 7, 2026')
  })

  it('renders property image when provided', async () => {
    const html = await renderTemplate(PropertyUnlockedEmail, {
      propertyAddress: '1234 Oak Ridge Dr, Springfield, IL',
      propertyImageUrl: 'https://example.com/property.jpg',
      amount: '$50.00',
      transactionID: 'TXN-987654321',
      date: 'April 7, 2026',
    })
    expect(html).toContain('https://example.com/property.jpg')
  })

  it('renders without image when not provided', async () => {
    const html = await renderTemplate(PropertyUnlockedEmail, {
      propertyAddress: '1234 Oak Ridge Dr, Springfield, IL',
      amount: '$50.00',
      transactionID: 'TXN-987654321',
      date: 'April 7, 2026',
    })
    expect(html).toContain('Property Unlocked')
    expect(html).toContain('one-time charge')
  })

  it('renders product name when provided', async () => {
    const html = await renderTemplate(PropertyUnlockedEmail, {
      propertyAddress: '1234 Oak Ridge Dr, Springfield, IL',
      amount: '$50.00',
      transactionID: 'TXN-987654321',
      date: 'April 7, 2026',
      productName: 'Property Unlock',
    })
    expect(html).toContain('Property Unlock')
  })
})

// ─── Daily Health Report ───────────────────────────────────────────────────

describe('DailyHealthReportEmail', () => {
  it('renders report date and overall status', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, baseHealthReport)
    expect(html).toContain('February 27, 2026')
    expect(html).toContain('✓ Healthy')
    expect(html).toContain('All systems operating normally.')
  })

  it('renders revenue and subscription metrics', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, baseHealthReport)
    expect(html).toContain('$1,234.56')
    expect(html).toContain('42') // successfulRenewals
    expect(html).toContain('200') // activeSubscriptions
  })

  it('does NOT render failure reasons section when absent', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      failureReasons: undefined,
    })
    expect(html).not.toContain('Top Failure Reasons')
  })

  it('renders failure reasons section when present', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      failureReasons: [
        { reason: 'Card declined', count: 3 },
        { reason: 'Insufficient funds', count: 1 },
      ],
    })
    expect(html).toContain('Top Failure Reasons')
    expect(html).toContain('Card declined')
    expect(html).toContain('3 occurrences')
    expect(html).toContain('Insufficient funds')
    expect(html).toContain('1 occurrence')
  })

  it('does NOT render recent errors section when absent', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      recentErrors: undefined,
    })
    expect(html).not.toContain('Recent Errors')
  })

  it('renders recent errors section when present', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      recentErrors: [
        { timestamp: '2026-02-27 10:00', component: 'PaymentService', message: 'Square API timeout' },
      ],
    })
    expect(html).toContain('Recent Errors')
    expect(html).toContain('PaymentService')
    expect(html).toContain('Square API timeout')
  })

  it('does NOT render action items section when absent', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      actionItems: undefined,
    })
    expect(html).not.toContain('Action Required')
  })

  it('renders action items section when present', async () => {
    const html = await renderTemplate(DailyHealthReportEmail, {
      ...baseHealthReport,
      actionItems: ['• Review 2 critical error(s) immediately'],
    })
    expect(html).toContain('Action Required')
    expect(html).toContain('Review 2 critical error(s) immediately')
  })
})
