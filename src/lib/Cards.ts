import { Req, Res } from "@/lib/types"

export default class Payments {
  req: Req
  res: Res

  constructor(req: Req, res: Res) {
    this.req = req
    this.res = res
  }

  /**
   * Creates a square card token from provided card details
   *
   * This is only used for testing purposes to simulate card token creation.
   *
   * In production, card tokens are created via Square's secure payment form, so card details never hit our servers.
   */
  testCreateCardTokenFromCardDetails() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("testCreateCardTokenFromCardDetails should not be used in production")
    }
  }
}
