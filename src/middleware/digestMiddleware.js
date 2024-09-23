import { v4 as uuid } from "uuid"

export default function digest(req, res, next) {
  // adds unique id to each request
  // used for logging to track the request
  req.id = uuid()

  next()
}
