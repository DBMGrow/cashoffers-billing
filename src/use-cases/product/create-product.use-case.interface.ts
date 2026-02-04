import { IUseCase, UseCaseResult } from "../base/use-case.interface"
import { CreateProductInput, CreateProductOutput } from "../types/product.types"

/**
 * Use case interface for creating a product
 */
export interface ICreateProductUseCase extends IUseCase<CreateProductInput, UseCaseResult<CreateProductOutput>> {}
