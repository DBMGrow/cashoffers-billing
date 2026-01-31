/**
 * Base Entity Interface
 * All domain entities should extend this interface
 */
export interface IEntity<TId = number> {
  /**
   * Unique identifier for the entity
   */
  readonly id: TId

  /**
   * When the entity was created
   */
  readonly createdAt: Date

  /**
   * When the entity was last updated
   */
  readonly updatedAt: Date

  /**
   * Check if two entities are equal (based on ID)
   */
  equals(other: IEntity<TId>): boolean
}

/**
 * Base abstract entity class
 * Provides common functionality for all entities
 */
export abstract class Entity<TId = number> implements IEntity<TId> {
  constructor(
    public readonly id: TId,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  equals(other: IEntity<TId>): boolean {
    if (!other) return false
    if (this === other) return true
    return this.id === other.id
  }

  /**
   * Validate entity invariants
   * Override in subclasses to add specific validation
   */
  protected validate(): void {
    if (!this.id) {
      throw new Error("Entity ID is required")
    }
    if (!this.createdAt) {
      throw new Error("Entity createdAt is required")
    }
    if (!this.updatedAt) {
      throw new Error("Entity updatedAt is required")
    }
  }
}
