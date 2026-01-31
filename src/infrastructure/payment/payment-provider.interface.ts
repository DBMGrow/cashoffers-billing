/**
 * Payment Provider Interface
 * Abstracts payment processing (Square API)
 */
export interface IPaymentProvider {
  /**
   * Create a payment/charge
   */
  createPayment(request: CreatePaymentRequest): Promise<PaymentResult>

  /**
   * Create a customer card token
   */
  createCard(request: CreateCardRequest): Promise<CardResult>

  /**
   * Retrieve card information
   */
  getCard(cardId: string): Promise<CardInfo>

  /**
   * Refund a payment
   */
  refundPayment(request: RefundPaymentRequest): Promise<RefundResult>
}

/**
 * Create payment request
 */
export interface CreatePaymentRequest {
  sourceId: string
  amountMoney: {
    amount: bigint
    currency: string
  }
  locationId?: string
  idempotencyKey?: string
  note?: string
  customerId?: string
}

/**
 * Payment result
 */
export interface PaymentResult {
  id: string
  status: string
  amountMoney: {
    amount: bigint
    currency: string
  }
  createdAt: string
  receiptUrl?: string
  cardDetails?: {
    card?: {
      last4: string
      cardBrand: string
      expMonth: number
      expYear: number
    }
  }
}

/**
 * Create card request
 */
export interface CreateCardRequest {
  sourceId: string
  customerId?: string
  card: {
    cardholderName?: string
    billingAddress?: {
      postalCode?: string
    }
  }
}

/**
 * Card result
 */
export interface CardResult {
  id: string
  last4: string
  cardBrand: string
  expMonth: number
  expYear: number
  cardholderName?: string
  billingAddress?: {
    postalCode?: string
  }
}

/**
 * Card information
 */
export interface CardInfo {
  id: string
  last4: string
  cardBrand: string
  expMonth: number
  expYear: number
  enabled: boolean
}

/**
 * Refund payment request
 */
export interface RefundPaymentRequest {
  paymentId: string
  amountMoney: {
    amount: bigint
    currency: string
  }
  idempotencyKey?: string
  reason?: string
}

/**
 * Refund result
 */
export interface RefundResult {
  id: string
  status: string
  amountMoney: {
    amount: bigint
    currency: string
  }
  createdAt: string
}
