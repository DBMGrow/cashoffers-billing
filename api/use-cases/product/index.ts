import { logger } from '@api/lib/services'
import { productRepository } from '@api/lib/repositories'
import { CreateProductUseCase } from './create-product.use-case'

export const createProductUseCase = new CreateProductUseCase({
  logger,
  productRepository,
})
