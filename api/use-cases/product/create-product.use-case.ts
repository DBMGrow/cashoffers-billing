import { ILogger } from "@api/infrastructure/logging/logger.interface"
import type { ProductRepository } from "@api/lib/repositories"
import { ICreateProductUseCase } from "./create-product.use-case.interface"
import { CreateProductInput, CreateProductOutput } from "../types/product.types"
import { UseCaseResult, success, failure } from "../base/use-case.interface"
import { CreateProductInputSchema } from "../types/validation.schemas"

interface Dependencies {
  logger: ILogger
  productRepository: ProductRepository
}

/**
 * CreateProductUseCase
 *
 * Creates a product with:
 * - Input validation
 * - Database storage
 * - Logging
 */
export class CreateProductUseCase implements ICreateProductUseCase {
  constructor(private readonly deps: Dependencies) {}

  async execute(input: CreateProductInput): Promise<UseCaseResult<CreateProductOutput>> {
    const { logger, productRepository } = this.deps
    const startTime = Date.now()

    try {
      // Validate input
      const validationResult = CreateProductInputSchema.safeParse(input)
      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((issue) => issue.message).join(", ")
        logger.error("Create product validation failed", { errors, input })
        return failure(errors, "CREATE_PRODUCT_VALIDATION_ERROR")
      }

      const validatedInput = validationResult.data
      logger.info("Creating product", { productName: validatedInput.productName })

      // Create product in database
      const product = await productRepository.create({
        product_name: validatedInput.productName,
        product_description: validatedInput.productDescription || null,
        product_type: validatedInput.productType,
        price: validatedInput.price,
        data: validatedInput.data ? JSON.stringify(validatedInput.data) : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      logger.info("Product created successfully", {
        productId: product.product_id,
        productName: validatedInput.productName,
        duration: Date.now() - startTime,
      })

      return success({
        productId: product.product_id,
        productName: product.product_name,
        productType: product.product_type,
        price: product.price,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error("Create product error", {
        error: errorMessage,
        duration: Date.now() - startTime,
      })

      return failure(errorMessage, "CREATE_PRODUCT_ERROR")
    }
  }
}
