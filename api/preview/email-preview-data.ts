/**
 * Sample data for email template previews
 * Used to generate preview HTML files for visual testing
 */

export interface TemplatePreview {
  name: string
  template: string
  subject: string
  variables: Record<string, string>
  description: string
}

export const emailPreviews: TemplatePreview[] = [
  {
    name: "Payment Confirmation",
    template: "payment-confirmation.mjml",
    subject: "Payment Successful - CashOffers",
    variables: {
      amount: "$250.00",
      transactionID: "TXN-20240131-ABC123",
      date: "January 31, 2024",
    },
    description: "Sent when a one-time payment is successfully processed",
  },
  {
    name: "Payment Error",
    template: "payment-error.mjml",
    subject: "Payment Failed - CashOffers",
    variables: {
      amount: "$250.00",
      errorMessage:
        "Your card was declined by your bank. This could be due to insufficient funds or security restrictions.",
      suggestions:
        "• Try a different payment method<br>• Contact your bank to authorize the transaction<br>• Verify your card details are correct",
      updatePaymentUrl: "https://cashoffers.com/billing/update",
      date: "January 31, 2024",
    },
    description: "Sent when a payment fails with recovery suggestions",
  },
  {
    name: "Subscription Created",
    template: "subscriptionCreated.mjml",
    subject: "Welcome to CashOffers - Subscription Created",
    variables: {
      subscription: "Premium Plan",
      amount: "$148.00",
      date: "January 31, 2024",
      lineItems: [
        `<tr>
        <td style="color: #374151; font-size: 13px; padding: 0 0 0 16px;">
          <div style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Signup Fee</div>
        </td>
        <td style="text-align: right; font-size: 13px; color: #374151; padding: 0 16px 0 0;">
          <div style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">$49.00</div>
        </td>
      </tr>`,
        `<tr>
        <td style="color: #374151; font-size: 13px; padding: 0 0 0 16px;">
          <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">Premium Plan</div>
        </td>
        <td style="text-align: right; font-size: 13px; color: #374151; padding: 0 16px 0 0;">
          <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">$99.00</div>
        </td>
      </tr>`,
      ].join("\n"),
    },
    description: "Sent when a new subscription is created",
  },
  {
    name: "Subscription Renewed",
    template: "subscriptionRenewal.mjml",
    subject: "Subscription Renewed - CashOffers",
    variables: {
      subscription: "Premium Plan",
      amount: "$148.00",
      date: "January 31, 2024",
      lineItems: [
        `<tr>
        <td style="color: #374151; font-size: 13px; padding: 0 0 0 16px;">
          <div style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">Premium Plan</div>
        </td>
        <td style="text-align: right; font-size: 13px; color: #374151; padding: 0 16px 0 0;">
          <div style="padding: 10px 0; border-bottom: 1px solid #f3f4f6;">$99.00</div>
        </td>
      </tr>`,
        `<tr>
        <td style="color: #374151; font-size: 13px; padding: 0 0 0 16px;">
          <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">HomeUptick Add-on</div>
        </td>
        <td style="text-align: right; font-size: 13px; color: #374151; padding: 0 16px 0 0;">
          <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">$49.00</div>
        </td>
      </tr>`,
      ].join("\n"),
    },
    description: "Sent when a subscription is successfully renewed",
  },
  {
    name: "Subscription Renewal Failed",
    template: "subscriptionRenewalFailed.mjml",
    subject: "Action Required: Subscription Renewal Failed",
    variables: {
      subscription: "Premium Plan",
      date: "January 31, 2024",
      link: "https://cashoffers.com/billing/update",
    },
    description: "Sent when subscription renewal payment fails",
  },
  {
    name: "Subscription Cancelled",
    template: "subscriptionCancelled.mjml",
    subject: "Admin: User Subscription Cancellation",
    variables: {
      name: "John Doe",
      email: "john.doe@example.com",
    },
    description: "Admin notification when user cancels subscription",
  },
  {
    name: "Subscription Downgraded",
    template: "subscriptionDowngraded.mjml",
    subject: "Admin: User Subscription Downgrade",
    variables: {
      name: "Jane Smith",
      email: "jane.smith@example.com",
    },
    description: "Admin notification when user downgrades subscription",
  },
  {
    name: "Subscription Paused",
    template: "subscriptionPaused.mjml",
    subject: "Your Subscription Has Been Paused",
    variables: {
      subscription: "Premium Plan",
    },
    description: "Sent when subscription is paused",
  },
  {
    name: "Subscription Suspended",
    template: "subscriptionSuspended.mjml",
    subject: "Action Required: Subscription Suspended",
    variables: {
      subscription: "Premium Plan",
      link: "https://cashoffers.com/billing/update",
    },
    description: "Sent when subscription is suspended due to payment issues",
  },
  {
    name: "Subscription Plan Updated",
    template: "subscriptionPlanUpdated.mjml",
    subject: "Your Subscription Plan Has Been Updated",
    variables: {
      subscription: "Professional Plan",
      amount: "$199.00",
      date: "February 15, 2024",
    },
    description: "Sent when user changes their subscription plan",
  },
  {
    name: "Card Updated",
    template: "cardUpdated.mjml",
    subject: "Payment Method Updated - CashOffers",
    variables: {
      message: "Your payment method has been successfully updated.",
      card: "•••• •••• •••• 4242",
      date: "January 31, 2024",
    },
    description: "Sent when user updates their payment card",
  },
  {
    name: "Refund Processed",
    template: "refund.mjml",
    subject: "Refund Processed - CashOffers",
    variables: {
      amount: "$250.00",
      date: "January 31, 2024",
    },
    description: "Sent when a transaction is refunded",
  },
]
