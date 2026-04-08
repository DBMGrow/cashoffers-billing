export interface IHomeUptickApiClient {
  createAccount(userId: number, config: object): Promise<void>
  activateAccount(userId: number): Promise<void>
  deactivateAccount(userId: number): Promise<void>
  getClientCount(userId: number): Promise<number>
  setContactLimit(userId: number, limit: number): Promise<void>
}
