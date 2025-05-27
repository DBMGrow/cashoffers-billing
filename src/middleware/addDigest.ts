import { NextFunction, Request, Response } from "express"
import { v4 as uuidv4 } from "uuid"

/**
 * Adds a digest id to the request object.
 *
 * Allows for us to track and log requests.
 */
export const addDigest = (req: any, res: Response, next: NextFunction) => {
  req.digest_id = uuidv4()
  next()
}
