import { describe, it, expect, beforeEach } from "vitest"
import { CreateProductUseCase } from "./create-product.use-case"
import { ConsoleLogger } from "@api/infrastructure/logging/console.logger"

class MockProductRepository {
  private products: any[] = []

  async findById(id: number) {
    return this.products.find((p) => p.product_id === id) || null
  }

  async findAll() {
    return [...this.products]
  }

  async findOne(criteria: any) {
    return this.products.find((p) =>
      Object.entries(criteria).every(([k, v]) => p[k] === v)
    ) || null
  }

  async create(data: any) {
    const product = { product_id: this.products.length + 1, ...data }
    this.products.push(product)
    return product
  }

  async update(id: number, data: any) {
    const idx = this.products.findIndex((p) => p.product_id === id)
    if (idx === -1) return null
    this.products[idx] = { ...this.products[idx], ...data }
    return this.products[idx]
  }

  async delete(): Promise<void> {}

  getAll() {
    return this.products
  }
}

describe("CreateProductUseCase", () => {
  let useCase: CreateProductUseCase
  let productRepo: MockProductRepository

  beforeEach(() => {
    productRepo = new MockProductRepository()

    useCase = new CreateProductUseCase({
      logger: new ConsoleLogger(),
      productRepository: productRepo as any,
    })
  })

  describe("Input Validation", () => {
    it("should fail when productName is missing", async () => {
      const result = await useCase.execute({
        productName: "",
        productType: "subscription",
        price: 25000,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("CREATE_PRODUCT_VALIDATION_ERROR")
      }
    })

    it("should fail when price is negative", async () => {
      const result = await useCase.execute({
        productName: "Test Plan",
        productType: "subscription",
        price: -100,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("CREATE_PRODUCT_VALIDATION_ERROR")
      }
    })

    it("should fail when productType is invalid", async () => {
      const result = await useCase.execute({
        productName: "Test Plan",
        productType: "invalid_type" as any,
        price: 25000,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.code).toBe("CREATE_PRODUCT_VALIDATION_ERROR")
      }
    })
  })

  describe("Successful Creation", () => {
    it("should create a product and return its details", async () => {
      const result = await useCase.execute({
        productName: "Premium Monthly",
        productType: "subscription",
        price: 25000,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.productId).toBeGreaterThan(0)
        expect(result.data.productName).toBe("Premium Monthly")
        expect(result.data.productType).toBe("subscription")
        expect(result.data.price).toBe(25000)
      }
    })

    it("should save product to database", async () => {
      await useCase.execute({
        productName: "Premium Monthly",
        productType: "subscription",
        price: 25000,
      })

      const products = productRepo.getAll()
      expect(products).toHaveLength(1)
      expect(products[0].product_name).toBe("Premium Monthly")
      expect(products[0].price).toBe(25000)
    })

    it("should serialize data field as JSON string", async () => {
      const productData = {
        renewal_cost: 25000,
        duration: "monthly",
        user_config: { is_premium: 1, role: "AGENT" },
      }

      await useCase.execute({
        productName: "Premium Monthly",
        productType: "subscription",
        price: 25000,
        data: productData,
      })

      const products = productRepo.getAll()
      expect(typeof products[0].data).toBe("string")
      const parsed = JSON.parse(products[0].data)
      expect(parsed.duration).toBe("monthly")
      expect(parsed.user_config.role).toBe("AGENT")
    })

    it("should store null for data when not provided", async () => {
      await useCase.execute({
        productName: "Simple Plan",
        productType: "subscription",
        price: 0,
      })

      const products = productRepo.getAll()
      expect(products[0].data).toBeNull()
    })

    it("should store description when provided", async () => {
      await useCase.execute({
        productName: "Premium Monthly",
        productDescription: "Full access plan",
        productType: "subscription",
        price: 25000,
      })

      const products = productRepo.getAll()
      expect(products[0].product_description).toBe("Full access plan")
    })

    it("should store null description when not provided", async () => {
      await useCase.execute({
        productName: "Premium Monthly",
        productType: "subscription",
        price: 25000,
      })

      const products = productRepo.getAll()
      expect(products[0].product_description).toBeNull()
    })

    it("should allow zero price (free product)", async () => {
      const result = await useCase.execute({
        productName: "Free Tier",
        productType: "subscription",
        price: 0,
      })

      expect(result.success).toBe(true)
    })
  })
})
