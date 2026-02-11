import type { PaymentContext } from '@/config/config.interface'
import type { ILogger } from '@/infrastructure/logging/logger.interface'
import type {
  IPaymentProvider,
  CreatePaymentRequest,
  PaymentResult,
  CreateCardRequest,
  CardResult,
  CardInfo,
  RefundPaymentRequest,
  RefundResult,
} from './payment-provider.interface'

/**
 * Dual Environment Payment Provider
 * Routes requests to production or sandbox provider based on PaymentContext
 */
export class DualEnvironmentPaymentProvider implements IPaymentProvider {
  constructor(
    private productionProvider: IPaymentProvider,
    private sandboxProvider: IPaymentProvider | null,
    private logger: ILogger
  ) {
    this.logger.info('Dual environment payment provider initialized', {
      sandboxEnabled: sandboxProvider !== null,
    })
  }

  async createPayment(
    request: CreatePaymentRequest,
    context?: PaymentContext
  ): Promise<PaymentResult> {
    const provider = this.selectProvider(context)
    const result = await provider.createPayment(request, context)

    // Log for audit trail
    if (context?.testMode) {
      this.logger.info('[TEST MODE] Payment created in sandbox environment', {
        paymentId: result.id,
        userId: context.userId,
        source: context.source,
      })
    }

    return result
  }

  async createCard(request: CreateCardRequest, context?: PaymentContext): Promise<CardResult> {
    const provider = this.selectProvider(context)
    const result = await provider.createCard(request, context)

    // Log for audit trail
    if (context?.testMode) {
      this.logger.info('[TEST MODE] Card created in sandbox environment', {
        cardId: result.id,
        userId: context.userId,
        source: context.source,
      })
    }

    return result
  }

  async getCard(cardId: string, context?: PaymentContext): Promise<CardInfo> {
    const provider = this.selectProvider(context)
    return provider.getCard(cardId, context)
  }

  async refundPayment(
    request: RefundPaymentRequest,
    context?: PaymentContext
  ): Promise<RefundResult> {
    const provider = this.selectProvider(context)
    const result = await provider.refundPayment(request, context)

    // Log for audit trail
    if (context?.testMode) {
      this.logger.info('[TEST MODE] Refund created in sandbox environment', {
        refundId: result.id,
        paymentId: request.paymentId,
        userId: context.userId,
        source: context.source,
      })
    }

    return result
  }

  /**
   * Select the appropriate provider based on context
   * @private
   */
  private selectProvider(context?: PaymentContext): IPaymentProvider {
    if (context?.testMode) {
      if (!this.sandboxProvider) {
        this.logger.error('Sandbox mode requested but sandbox credentials not configured', {
          userId: context.userId,
          source: context.source,
        })
        throw new Error(
          'Test mode is not available. Sandbox credentials are not configured.'
        )
      }

      this.logger.debug('[TEST MODE] Using Square sandbox environment', {
        userId: context.userId,
        source: context.source,
        metadata: context.metadata,
      })

      return this.sandboxProvider
    }

    // Default to production
    return this.productionProvider
  }
}

/**
 * Create a dual environment payment provider
 */
export const createDualEnvironmentPaymentProvider = (
  productionProvider: IPaymentProvider,
  sandboxProvider: IPaymentProvider | null,
  logger: ILogger
): IPaymentProvider => {
  return new DualEnvironmentPaymentProvider(productionProvider, sandboxProvider, logger)
}
