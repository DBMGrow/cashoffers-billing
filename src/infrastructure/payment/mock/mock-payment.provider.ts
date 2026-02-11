import { v4 as uuidv4 } from 'uuid'
import type {
  IPaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  CreateCardRequest,
  CardResult,
  CardInfo,
  RefundPaymentRequest,
  RefundResult,
} from '../payment-provider.interface'

/**
 * Mock Payment Provider
 * For testing without hitting real payment APIs
 */
export class MockPaymentProvider implements IPaymentProvider {
  private payments: Map<string, PaymentResult> = new Map()
  private cards: Map<string, CardInfo> = new Map()
  private refunds: Map<string, RefundResult> = new Map()

  // Configuration for testing different scenarios
  public shouldFail = false
  public failureReason = 'Mock payment failed'
  private nextPaymentStatus: 'COMPLETED' | 'FAILED' | 'PENDING' = 'COMPLETED'

  async createPayment(request: CreatePaymentRequest): Promise<PaymentResult> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    // Check if the card exists in our mock store
    const cardExists = request.sourceId && this.cards.has(request.sourceId)
    if (request.sourceId && !cardExists) {
      throw new Error(`Card ${request.sourceId} not found`)
    }

    const paymentId = `mock_payment_${uuidv4()}`
    const status = this.nextPaymentStatus

    // Reset to COMPLETED after use
    this.nextPaymentStatus = 'COMPLETED'

    const payment: PaymentResult = {
      id: paymentId,
      status,
      amountMoney: {
        amount: request.amountMoney.amount,
        currency: request.amountMoney.currency,
      },
      createdAt: new Date().toISOString(),
      receiptUrl: `https://mock-receipt.com/${paymentId}`,
      cardDetails: {
        card: {
          last4: '1234',
          cardBrand: 'VISA',
          expMonth: 12,
          expYear: 2025,
        },
      },
      environment: 'production',
    }

    this.payments.set(paymentId, payment)
    return payment
  }

  async createCard(request: CreateCardRequest): Promise<CardResult> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const cardId = `mock_card_${uuidv4()}`
    const card: CardResult = {
      id: cardId,
      last4: '1234',
      cardBrand: 'VISA',
      expMonth: 12,
      expYear: 2025,
      cardholderName: request.card.cardholderName,
      billingAddress: request.card.billingAddress,
      environment: 'production',
    }

    this.cards.set(cardId, {
      ...card,
      enabled: true,
    })

    return card
  }

  async getCard(cardId: string): Promise<CardInfo> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const card = this.cards.get(cardId)
    if (!card) {
      throw new Error('Card not found')
    }

    return card
  }

  async refundPayment(request: RefundPaymentRequest): Promise<RefundResult> {
    if (this.shouldFail) {
      throw new Error(this.failureReason)
    }

    const payment = this.payments.get(request.paymentId)
    if (!payment) {
      throw new Error('Payment not found')
    }

    const refundId = `mock_refund_${uuidv4()}`
    const refund: RefundResult = {
      id: refundId,
      status: 'COMPLETED',
      amountMoney: {
        amount: request.amountMoney.amount,
        currency: request.amountMoney.currency,
      },
      createdAt: new Date().toISOString(),
      environment: 'production',
    }

    this.refunds.set(refundId, refund)
    return refund
  }

  // Test helpers
  reset(): void {
    this.payments.clear()
    this.cards.clear()
    this.refunds.clear()
    this.shouldFail = false
    this.failureReason = 'Mock payment failed'
    this.nextPaymentStatus = 'COMPLETED'
  }

  getPayments(): PaymentResult[] {
    return Array.from(this.payments.values())
  }

  getCards(): CardInfo[] {
    return Array.from(this.cards.values())
  }

  getRefunds(): RefundResult[] {
    return Array.from(this.refunds.values())
  }

  /**
   * Set the status that the next payment will have
   * Useful for testing failed payments
   */
  setNextPaymentStatus(status: 'COMPLETED' | 'FAILED' | 'PENDING'): void {
    this.nextPaymentStatus = status
  }

  /**
   * Add a card to the mock store for testing
   */
  addTestCard(card: { id: string; customerId?: string; last4: string; cardBrand: string; expMonth: number; expYear: number }): void {
    this.cards.set(card.id, {
      ...card,
      enabled: true,
    })
  }
}

/**
 * Create a mock payment provider
 */
export const createMockPaymentProvider = (): MockPaymentProvider => {
  return new MockPaymentProvider()
}
